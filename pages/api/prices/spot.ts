import {ETH_TOKEN_ADDRESS, YFI_ADDRESS} from '@builtbymom/web3/utils/constants';

import type {NextApiRequest, NextApiResponse} from 'next';

const PRICE_SERVICE_URL = 'https://prices.yearn.dev/api/prices/spot';
const MAX_PRICE_AGE_SECONDS = 15 * 60;
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

const PRICE_KEYS = [
	{key: `ethereum:${YFI_ADDRESS.toLowerCase()}`, aliases: [YFI_ADDRESS]},
	{key: `ethereum:${WETH_ADDRESS.toLowerCase()}`, aliases: [WETH_ADDRESS, ETH_TOKEN_ADDRESS]}
];

type TPriceEntry = {
	price?: unknown;
	timestamp?: unknown;
};

type TPriceServiceCoin = {
	prices?: TPriceEntry[];
	error?: {code?: string; message?: string};
};

type TPriceServiceCoinMap = {[coinKey: string]: TPriceServiceCoin};
type TPricesByChain = {[chainID: number]: {[address: string]: number}};

type TPriceServiceResponse = {
	coins?: TPriceServiceCoinMap;
};

type TSpotResponse = {
	prices?: TPricesByChain;
	error?: string;
};

function freshPrice(coin: TPriceServiceCoin | undefined, nowSeconds: number): number | undefined {
	if (coin?.error) {
		return undefined;
	}
	const entry = coin?.prices?.[0];
	const price = entry?.price;
	const timestamp = entry?.timestamp;
	if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
		return undefined;
	}
	if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
		return undefined;
	}
	const age = nowSeconds - timestamp;
	if (age < -60 || age > MAX_PRICE_AGE_SECONDS) {
		return undefined;
	}
	return price;
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse<TSpotResponse>
): Promise<void> {
	res.setHeader('Cache-Control', 'private, no-store, max-age=0');
	if (req.method !== 'GET') {
		res.setHeader('Allow', 'GET');
		res.status(405).json({error: 'Method not allowed'});
		return;
	}

	const apiKey = process.env.YEARN_PRICES_API_KEY?.trim();
	if (!apiKey) {
		res.status(503).json({error: 'Price Service is not configured'});
		return;
	}

	try {
		const url = new URL(PRICE_SERVICE_URL);
		url.searchParams.set('coins', JSON.stringify(PRICE_KEYS.map(({key}) => key)));
		const upstream = await fetch(url, {
			headers: {Authorization: `Bearer ${apiKey}`},
			cache: 'no-store'
		});
		if (!upstream.ok) {
			res.status(502).json({error: 'Price Service request failed'});
			return;
		}

		const body = (await upstream.json()) as TPriceServiceResponse;
		if (!body || typeof body.coins !== 'object' || body.coins === null) {
			res.status(502).json({error: 'Price Service response was invalid'});
			return;
		}
		const coinsByLowercaseKey = new Map(
			Object.entries(body.coins).map(([key, coin]) => [key.toLowerCase(), coin])
		);

		const nowSeconds = Date.now() / 1000;
		const prices: TPricesByChain = {1: {}};
		for (const {key, aliases} of PRICE_KEYS) {
			const price = freshPrice(coinsByLowercaseKey.get(key.toLowerCase()), nowSeconds);
			if (price === undefined) {
				continue;
			}
			for (const address of aliases) {
				prices[1][address.toLowerCase()] = price;
			}
		}
		res.status(200).json({prices});
	} catch {
		res.status(502).json({error: 'Price Service request failed'});
	}
}
