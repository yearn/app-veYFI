import useSWR from 'swr';

type TPriceServiceResponse = {
	prices?: Record<number, Record<string, number>>;
};

async function fetchPriceServiceSpot(): Promise<TPriceServiceResponse> {
	const response = await fetch('/api/prices/spot', {cache: 'no-store'});
	if (!response.ok) {
		throw new Error('Price quotes are unavailable');
	}
	return (await response.json()) as TPriceServiceResponse;
}

export function usePriceServiceSpot(): Record<number, Record<string, number>> {
	const {data, error, isValidating} = useSWR<TPriceServiceResponse>('/api/prices/spot', fetchPriceServiceSpot, {
		revalidateOnFocus: true,
		revalidateOnReconnect: true,
		refreshInterval: 60 * 1000,
		shouldRetryOnError: false
	});

	// Do not reuse an old quote while the service is refreshing or unavailable.
	if (error || isValidating) {
		return {};
	}
	return data?.prices ?? {};
}
