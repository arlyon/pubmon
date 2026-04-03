import { ALL_PUBMON } from "./lib/pokemon-data";

const COMFY_URL = "http://localhost:8188/prompt";
const WORKFLOW_NAME = "pubmon";

async function generateImage(name: string, description: string) {
	const payload = {
		prompt: {
			"9": {
				inputs: {
					filename_prefix: ["96", 0],
					images: ["76:65", 0],
				},
				class_type: "SaveImage",
				_meta: { title: "Save Image" },
			},
			"95": {
				inputs: {
					value: name + ", " + description,
				},
				class_type: "PrimitiveString",
				_meta: { title: "String" },
			},
			"96": {
				inputs: {
					value: name,
				},
				class_type: "PrimitiveString",
				_meta: { title: "String" },
			},
			"76:67": {
				inputs: {
					text: ["95", 0],
					clip: ["76:62", 0],
				},
				class_type: "CLIPTextEncode",
				_meta: { title: "CLIP Text Encode (Positive Prompt)" },
			},
			"76:68": {
				inputs: {
					width: 1024,
					height: 1024,
					batch_size: 1,
				},
				class_type: "EmptySD3LatentImage",
				_meta: { title: "EmptySD3LatentImage" },
			},
			"76:63": {
				inputs: {
					vae_name: "ae.safetensors",
				},
				class_type: "VAELoader",
				_meta: { title: "Load VAE" },
			},
			"76:62": {
				inputs: {
					clip_name: "qwen_3_4b.safetensors",
					type: "lumina2",
					device: "default",
				},
				class_type: "CLIPLoader",
				_meta: { title: "Load CLIP" },
			},
			"76:65": {
				inputs: {
					samples: ["76:69", 0],
					vae: ["76:63", 0],
				},
				class_type: "VAEDecode",
				_meta: { title: "VAE Decode" },
			},
			"76:70": {
				inputs: {
					shift: 3,
					model: ["76:94", 0],
				},
				class_type: "ModelSamplingAuraFlow",
				_meta: { title: "ModelSamplingAuraFlow" },
			},
			"76:66": {
				inputs: {
					unet_name: "z_image_bf16.safetensors",
					weight_dtype: "default",
				},
				class_type: "UNETLoader",
				_meta: { title: "Load Diffusion Model" },
			},
			"76:71": {
				inputs: {
					text: "",
					clip: ["76:62", 0],
				},
				class_type: "CLIPTextEncode",
				_meta: { title: "CLIP Text Encode (Negative Prompt)" },
			},
			"76:69": {
				inputs: {
					seed: Math.floor(Math.random() * 1000000000000000),
					steps: 30,
					cfg: 4,
					sampler_name: "res_multistep",
					scheduler: "simple",
					denoise: 1,
					model: ["76:70", 0],
					positive: ["76:67", 0],
					negative: ["76:71", 0],
					latent_image: ["76:68", 0],
				},
				class_type: "KSampler",
				_meta: { title: "KSampler" },
			},
			"76:94": {
				inputs: {
					lora_name: "fakemon_zimage_lokr_v4_prodigy_000001500.safetensors",
					strength_model: 1,
					model: ["76:66", 0],
				},
				class_type: "LoraLoaderModelOnly",
				_meta: { title: "Load LoRA" },
			},
		},
	};

	try {
		const response = await fetch(COMFY_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		const result = await response.json();
		console.log(`✓ Queued ${name}:`, result.prompt_id);
		return result;
	} catch (error) {
		console.error(`✗ Failed to queue ${name}:`, error);
		throw error;
	}
}

async function generateImageDistilled(name: string, description: string) {
	const payload = {
		prompt: {
			"9": {
				inputs: {
					filename_prefix: ["96", 0],
					images: ["76:65", 0],
				},
				class_type: "SaveImage",
				_meta: {
					title: "Save Image",
				},
			},
			"95": {
				inputs: {
					value: name + ", " + description,
				},
				class_type: "PrimitiveString",
				_meta: {
					title: "String",
				},
			},
			"96": {
				inputs: {
					value: name,
				},
				class_type: "PrimitiveString",
				_meta: {
					title: "String",
				},
			},
			"97": {
				inputs: {
					texts: ["95", 0],
					suffix: ", white background",
				},
				class_type: "AddTextSuffix",
				_meta: {
					title: "Add Text Suffix",
				},
			},
			"76:67": {
				inputs: {
					text: ["97", 0],
					clip: ["76:62", 0],
				},
				class_type: "CLIPTextEncode",
				_meta: {
					title: "CLIP Text Encode (Positive Prompt)",
				},
			},
			"76:68": {
				inputs: {
					width: 1024,
					height: 1024,
					batch_size: 1,
				},
				class_type: "EmptySD3LatentImage",
				_meta: {
					title: "EmptySD3LatentImage",
				},
			},
			"76:63": {
				inputs: {
					vae_name: "ae.safetensors",
				},
				class_type: "VAELoader",
				_meta: {
					title: "Load VAE",
				},
			},
			"76:62": {
				inputs: {
					clip_name: "qwen_3_4b.safetensors",
					type: "lumina2",
					device: "default",
				},
				class_type: "CLIPLoader",
				_meta: {
					title: "Load CLIP",
				},
			},
			"76:65": {
				inputs: {
					samples: ["76:69", 0],
					vae: ["76:63", 0],
				},
				class_type: "VAEDecode",
				_meta: {
					title: "VAE Decode",
				},
			},
			"76:70": {
				inputs: {
					shift: 3,
					model: ["76:94", 0],
				},
				class_type: "ModelSamplingAuraFlow",
				_meta: {
					title: "ModelSamplingAuraFlow",
				},
			},
			"76:66": {
				inputs: {
					unet_name:
						"RedZDPO-v5-ZIB-Distilled-Veris-8steps-BF16-ComfyUi.safetensors",
					weight_dtype: "default",
				},
				class_type: "UNETLoader",
				_meta: {
					title: "Load Diffusion Model",
				},
			},
			"76:71": {
				inputs: {
					text: "",
					clip: ["76:62", 0],
				},
				class_type: "CLIPTextEncode",
				_meta: {
					title: "CLIP Text Encode (Negative Prompt)",
				},
			},
			"76:69": {
				inputs: {
					seed: Math.floor(Math.random() * 1000000000000000),
					steps: 12,
					cfg: 1.2,
					sampler_name: "euler",
					scheduler: "simple",
					denoise: 1,
					model: ["76:70", 0],
					positive: ["76:67", 0],
					negative: ["76:71", 0],
					latent_image: ["76:68", 0],
				},
				class_type: "KSampler",
				_meta: {
					title: "KSampler",
				},
			},
			"76:94": {
				inputs: {
					lora_name: "fakemon_zimage_lokr_v4_prodigy_000001500.safetensors",
					strength_model: 1,
					model: ["76:66", 0],
				},
				class_type: "LoraLoaderModelOnly",
				_meta: {
					title: "Load LoRA",
				},
			},
		},
	};

	try {
		const response = await fetch(COMFY_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		const result = await response.json();

		console.log(`✓ Queued ${name}:`, result.prompt_id);
		return result;
	} catch (error) {
		console.error(`✗ Failed to queue ${name}:`, error);
		throw error;
	}
}

async function main() {
	console.log(`Processing ${ALL_PUBMON.length} Pokemon...`);

	const pubmon = arrayShuffle(ALL_PUBMON);

	for (const pokemon of pubmon) {
		const desc = pokemon.visuals;
		if (desc) {
			await generateImageDistilled(pokemon.name, desc);
		}
	}

	console.log("All images queued!");
}

main().catch(console.error);

export function arrayShuffle(array, options = {}) {
	if (!Array.isArray(array)) {
		throw new TypeError(`Expected an array, got ${typeof array}`);
	}

	if (
		options !== undefined &&
		(options === null || typeof options !== "object")
	) {
		throw new TypeError(
			`Expected options to be an object, got ${typeof options}`,
		);
	}

	const { randomNumberGenerator = Math.random } = options ?? {};

	// eslint-disable-next-line no-warning-comments
	// TODO: Consider a seed option when the TC39 seeded random proposal lands.
	if (typeof randomNumberGenerator !== "function") {
		throw new TypeError(
			`Expected randomNumberGenerator to be a function, got ${typeof randomNumberGenerator}`,
		);
	}

	for (let index = array.length - 1; index > 0; index--) {
		const newIndex = Math.floor(randomNumberGenerator() * (index + 1));
		[array[index], array[newIndex]] = [array[newIndex], array[index]];
	}

	return array;
}
