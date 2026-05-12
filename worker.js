import { AutoModel, AutoProcessor, env, RawImage } from './engine_v16/transformers.min.js';

// 纯本地离线加载极其精细的 RMBG-1.4 工业模型
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = './models/';
// 必须显式指定本地绝对 URL，否则 transformers.js v3 内部会触发默认的 CDN fallback 回退！
env.backends.onnx.wasm.wasmPaths = new URL('./engine_v16/', self.location.href).href;

let model = null;
let processor = null;

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    const { action, blobUrl } = event.data;

    if (action === 'load') {
        try {
            if (!model) {
                // 加载专门针对人像抠图的 ModNet 模型
                model = await AutoModel.from_pretrained('Xenova/modnet', {
                    quantized: true,
                    config: { model_type: 'custom' },
                    progress_callback: (info) => {
                        self.postMessage({ status: 'progress', info });
                    }
                });
                processor = await AutoProcessor.from_pretrained('Xenova/modnet');
            }
            self.postMessage({ status: 'ready' });
        } catch (error) {
            self.postMessage({ status: 'error', error: error.message });
        }
    } else if (action === 'segment') {
        try {
            // 1. 读取并预处理图片
            const image = await RawImage.fromURL(blobUrl);
            const inputs = await processor(image);

            // 2. 核心 AI 张量推理
            // v3 API 破坏性变更: 如果以 custom 模式加载，必须手动将 inputs.pixel_values 映射为 ONNX 期待的 "input"
            const modelInputs = inputs.pixel_values ? { input: inputs.pixel_values } : inputs;
            const outputs = await model(modelInputs);
            const outputTensor = Object.values(outputs)[0]; // 获取返回的第一个 Tensor

            // 3. 模型本身已经自带 Sigmoid，输出即为严格的 [0, 1] 概率分布
            const floatData = outputTensor.data;
            const maskH = outputTensor.dims[2];
            const maskW = outputTensor.dims[3];

            // 3.5 在 [0, 1] 概率空间进行极速 3x3 Box Blur
            // 用于抹平 Q8 量化模型内部产生的 0.2~0.4 的噪点坑洞
            const smoothedData = new Float32Array(floatData.length);
            for (let y = 1; y < maskH - 1; y++) {
                for (let x = 1; x < maskW - 1; x++) {
                    const i = y * maskW + x;
                    smoothedData[i] = (
                        floatData[i] +
                        floatData[i - 1] + floatData[i + 1] +
                        floatData[i - maskW] + floatData[i + maskW] +
                        floatData[i - maskW - 1] + floatData[i - maskW + 1] +
                        floatData[i + maskW - 1] + floatData[i + maskW + 1]
                    ) / 9.0;
                }
            }

            // 4. 将 Mask 转换成 1024x1024 的 RGBA 图像
            const maskRgba = new Uint8ClampedArray(maskW * maskH * 4);
            for (let i = 0; i < smoothedData.length; i++) {
                let p = smoothedData[i];

                // 智能对比度增强曲线 (Smart Contrast Curve)
                // 彻底解决 q8 量化模型引发的半透明漂白和满天星漏洞
                if (p > 0.7) {
                    p = 1.0;  // 只要概率达到 70%（经过平滑后），强制视为绝对实心人体
                } else if (p < 0.2) {
                    p = 0.0;  // 低于 20% 视为绝对背景
                } else {
                    p = (p - 0.2) / 0.50; // 保留 0.2 ~ 0.7 之间的柔和发丝渐变
                }

                const val = Math.round(p * 255);
                maskRgba[4 * i]     = val; // R
                maskRgba[4 * i + 1] = val; // G
                maskRgba[4 * i + 2] = val; // B
                maskRgba[4 * i + 3] = val; // A (最关键的透明度)
            }
            const maskImageData = new ImageData(maskRgba, maskW, maskH);

            // 5. 借助离屏 Canvas 使用浏览器原生高质量双线性插值进行缩放与合成
            const maskCanvas = new OffscreenCanvas(maskW, maskH);
            const maskCtx = maskCanvas.getContext('2d');
            maskCtx.putImageData(maskImageData, 0, 0);

            // 构造原图 Canvas
            const outCanvas = new OffscreenCanvas(image.width, image.height);
            const outCtx = outCanvas.getContext('2d');

            const imgRgba = new Uint8ClampedArray(image.width * image.height * 4);
            const channels = image.channels;
            for (let i = 0; i < image.width * image.height; ++i) {
                imgRgba[4 * i]     = image.data[channels * i];         // R
                imgRgba[4 * i + 1] = channels > 1 ? image.data[channels * i + 1] : image.data[channels * i]; // G
                imgRgba[4 * i + 2] = channels > 2 ? image.data[channels * i + 2] : image.data[channels * i]; // B
                imgRgba[4 * i + 3] = 255; // 初始全不透明
            }
            const originImageData = new ImageData(imgRgba, image.width, image.height);
            outCtx.putImageData(originImageData, 0, 0);

            // 使用 destination-in 模式：原图的 Alpha 会乘以 MaskCanvas 的 Alpha
            // 这种原生合成方式彻底消除了边缘锯齿和手动循环导致的错位问题！
            outCtx.globalCompositeOperation = 'destination-in';
            outCtx.drawImage(maskCanvas, 0, 0, image.width, image.height);

            // 6. 导出最终高质量 PNG
            const blob = await outCanvas.convertToBlob({ type: 'image/png' });
            const maskUrl = URL.createObjectURL(blob);
            self.postMessage({ status: 'done', maskUrl });

        } catch (error) {
            self.postMessage({ status: 'error', error: error.message });
        }
    }
});
