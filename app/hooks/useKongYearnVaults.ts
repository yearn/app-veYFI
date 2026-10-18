import {useMemo} from 'react';
import useSWR from 'swr';
import {toAddress} from '@builtbymom/web3/utils';

import type {TAddress} from '@builtbymom/web3/types';

const KONG_VAULT_LIST_URL = 'https://kong.yearn.fi/api/rest/list/vaults/1?origin=yearn';
const KONG_SNAPSHOT_URL = 'https://kong.yearn.fi/api/rest/snapshot/1';

type TRecord = Record<string, unknown>;

type TKongVaultListRecord = TRecord & {
	address?: unknown;
	chainId?: unknown;
	chainID?: unknown;
	name?: unknown;
	symbol?: unknown;
	decimals?: unknown;
	apiVersion?: unknown;
	version?: unknown;
	origin?: unknown;
	asset?: unknown;
	isHidden?: unknown;
	isRetired?: unknown;
	migration?: unknown;
	staking?: unknown;
	fees?: unknown;
	performance?: unknown;
	kind?: unknown;
};

type TKongSnapshot = TRecord & {
	meta?: unknown;
	asset?: unknown;
	apiVersion?: unknown;
	fees?: unknown;
	performance?: unknown;
	migration?: unknown;
	staking?: unknown;
	isHidden?: unknown;
	isRetired?: unknown;
};

type TKongToken = {
	address: TAddress;
	name?: string;
	symbol?: string;
	decimals?: number;
};

type TKongFeeData = {
	// Kong fee values are basis points and stay in their source units here.
	managementFee?: number;
	performanceFee?: number;
};

type TKongYieldData = {
	oracle?: {
		apr?: number;
		netAPR?: number;
		apy?: number;
		// Kong APY values are ratios; the gauge table converts netAPY for display.
		netAPY?: number;
	};
	historical?: {
		net?: number;
		weeklyNet?: number;
		monthlyNet?: number;
		inceptionNet?: number;
	};
};

type TKongStakingReward = {
	address?: TAddress;
	name?: string;
	symbol?: string;
	decimals?: number;
	apr?: number;
};

export type TYearnVault = {
	address: TAddress;
	chainID: number;
	name: string;
	symbol: string;
	decimals: number;
	version: string;
	kind?: string;
	token?: TKongToken;
	fees: TKongFeeData;
	performance: TKongYieldData;
	staking: {
		address: TAddress;
		available: boolean;
		source?: string;
		rewards: TKongStakingReward[];
	};
	migration: {
		available: boolean;
		address?: TAddress;
	};
	isHidden: boolean;
	isRetired: boolean;
};

function asRecord(value: unknown): TRecord | undefined {
	if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
		return value as TRecord;
	}
	return undefined;
}

function asAddress(value: unknown): TAddress | undefined {
	if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
		return undefined;
	}
	return toAddress(value);
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
	if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '')) {
		return undefined;
	}
	const parsed = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function migrationData(value: unknown): {available: boolean; address?: TAddress} {
	if (typeof value === 'boolean') {
		return {available: value};
	}
	const migration = asRecord(value);
	if (!migration) {
		return {available: false};
	}
	return {
		available: migration.available === true,
		address: asAddress(migration.target) ?? asAddress(migration.address)
	};
}

function feeData(value: unknown): TKongFeeData {
	const fees = asRecord(value);
	return {
		managementFee: asNumber(fees?.managementFee),
		performanceFee: asNumber(fees?.performanceFee)
	};
}

function yieldData(value: unknown): TKongYieldData {
	const performance = asRecord(value);
	const oracle = asRecord(performance?.oracle);
	const historical = asRecord(performance?.historical);
	return {
		oracle: {
			apr: asNumber(oracle?.apr),
			netAPR: asNumber(oracle?.netAPR),
			apy: asNumber(oracle?.apy),
			netAPY: asNumber(oracle?.netAPY)
		},
		historical: {
			net: asNumber(historical?.net),
			weeklyNet: asNumber(historical?.weeklyNet),
			monthlyNet: asNumber(historical?.monthlyNet),
			inceptionNet: asNumber(historical?.inceptionNet)
		}
	};
}

function stakingData(listValue: unknown, snapshotValue: unknown): TYearnVault['staking'] {
	const list = asRecord(listValue);
	const snapshot = asRecord(snapshotValue);
	const address = asAddress(snapshot?.address) ?? asAddress(list?.address);
	const isKnownAddress = Boolean(address && address.toLowerCase() !== '0x0000000000000000000000000000000000000000');
	const rewards = Array.isArray(snapshot?.rewards)
		? snapshot.rewards.flatMap((value): TKongStakingReward[] => {
				const reward = asRecord(value);
				if (!reward) {
					return [];
				}
				return [
					{
						address: asAddress(reward.address),
						name: asString(reward.name),
						symbol: asString(reward.symbol),
						decimals: asNumber(reward.decimals),
						apr: asNumber(reward.apr)
					}
				];
			})
		: [];

	return {
		address: isKnownAddress ? (address as TAddress) : toAddress('0x0000000000000000000000000000000000000000'),
		available: (snapshot?.available === true || list?.available === true) && isKnownAddress,
		source: asString(snapshot?.source) ?? asString(list?.source),
		rewards
	};
}

function normalizeVault(record: TKongVaultListRecord, snapshot?: TKongSnapshot): TYearnVault | undefined {
	const address = asAddress(record.address);
	const chainID = asNumber(record.chainId ?? record.chainID);
	const origin = asString(record.origin);
	if (!address || chainID !== 1 || origin !== 'yearn') {
		return undefined;
	}

	const meta = asRecord(snapshot?.meta);
	const recordAsset = asRecord(record.asset);
	const snapshotAsset = asRecord(snapshot?.asset) ?? asRecord(meta?.token);
	const asset = snapshotAsset ?? recordAsset;
	const assetAddress = asAddress(asset?.address);
	const token = assetAddress
		? {
				address: assetAddress,
				name: asString(asset?.name),
				symbol: asString(asset?.symbol),
				decimals: asNumber(asset?.decimals)
			}
		: undefined;
	const snapshotMigration = migrationData(snapshot?.migration ?? meta?.migration);
	const listMigration = migrationData(record.migration);
	const staking = stakingData(record.staking, snapshot?.staking);
	const snapshotHidden = meta?.isHidden === true || snapshot?.isHidden === true;
	const snapshotRetired = meta?.isRetired === true || snapshot?.isRetired === true;

	return {
		address,
		chainID,
		name: asString(record.name) ?? `Yearn vault ${address}`,
		symbol: asString(record.symbol) ?? '',
		decimals: asNumber(record.decimals) ?? token?.decimals ?? 18,
		version: asString(record.apiVersion) ?? asString(record.version) ?? 'unknown',
		kind: asString(meta?.kind) ?? asString(record.kind),
		token,
		fees: feeData(snapshot?.fees ?? record.fees),
		performance: yieldData(snapshot?.performance ?? record.performance),
		staking,
		migration: snapshotMigration.available ? snapshotMigration : listMigration,
		isHidden: record.isHidden === true || snapshotHidden,
		isRetired: record.isRetired === true || snapshotRetired
	};
}

async function fetchJSON<T>(url: string): Promise<T> {
	const response = await fetch(url, {cache: 'no-store'});
	if (!response.ok) {
		throw new Error(`Kong request failed with HTTP ${response.status}`);
	}
	return (await response.json()) as T;
}

async function fetchVaultList(): Promise<TKongVaultListRecord[]> {
	const records = await fetchJSON<unknown>(KONG_VAULT_LIST_URL);
	if (!Array.isArray(records)) {
		throw new Error('Kong vault list response must be an array');
	}
	return records.flatMap((record): TKongVaultListRecord[] => {
		const parsed = asRecord(record);
		return parsed ? [parsed as TKongVaultListRecord] : [];
	});
}

async function fetchSnapshots(addresses: string[]): Promise<Record<string, TKongSnapshot>> {
	const results = await Promise.allSettled(
		addresses.map(async (address): Promise<[string, TKongSnapshot]> => {
			const snapshot = await fetchJSON<unknown>(`${KONG_SNAPSHOT_URL}/${address}`);
			const record = asRecord(snapshot);
			if (!record) {
				throw new Error('Kong snapshot response must be an object');
			}
			return [address.toLowerCase(), record as TKongSnapshot];
		})
	);
	const snapshots: Record<string, TKongSnapshot> = {};
	for (const result of results) {
		if (result.status === 'fulfilled') {
			const [address, snapshot] = result.value;
			snapshots[address] = snapshot;
		} else {
			console.warn('Kong snapshot unavailable for a veYFI vault', result.reason);
		}
	}
	return snapshots;
}

export function useKongYearnVaults(): {
	vaults: Record<string, TYearnVault>;
	vaultsMigrations: Record<string, TYearnVault>;
	vaultsRetired: Record<string, TYearnVault>;
	isLoading: boolean;
	mutate: () => Promise<unknown>;
} {
	const {data: records, isLoading, mutate} = useSWR<TKongVaultListRecord[]>(KONG_VAULT_LIST_URL, fetchVaultList, {
		revalidateOnFocus: true,
		revalidateOnReconnect: true,
		refreshInterval: 5 * 60 * 1000
	});
	const snapshotAddresses = useMemo((): string[] => {
		return (records ?? [])
			.filter((record) => {
				const staking = asRecord(record.staking);
				return (
					record.origin === 'yearn' &&
					Number(record.chainId ?? record.chainID) === 1 &&
					record.isHidden !== true &&
					record.isRetired !== true &&
					staking?.available === true
				);
			})
			.map((record) => asAddress(record.address)?.toLowerCase())
			.filter((address): address is string => Boolean(address))
			.sort();
	}, [records]);
	const snapshotsKey = snapshotAddresses.length > 0 ? `kong-snapshots:${snapshotAddresses.join(',')}` : null;
	const {data: snapshots} = useSWR<Record<string, TKongSnapshot>>(
		snapshotsKey,
		() => fetchSnapshots(snapshotAddresses),
		{revalidateOnFocus: true, revalidateOnReconnect: true, refreshInterval: 5 * 60 * 1000}
	);

	const data = useMemo(() => {
		const vaults: Record<string, TYearnVault> = {};
		const vaultsMigrations: Record<string, TYearnVault> = {};
		const vaultsRetired: Record<string, TYearnVault> = {};
		for (const record of records ?? []) {
			const address = asAddress(record.address);
			const vault = normalizeVault(record, address ? snapshots?.[address.toLowerCase()] : undefined);
			if (!vault) {
				continue;
			}
			const key = vault.address;
			if (vault.migration.available) {
				vaultsMigrations[key] = vault;
			}
			if (vault.isHidden || vault.isRetired) {
				vaultsRetired[key] = vault;
			}
			if (!vault.migration.available && !vault.isHidden && !vault.isRetired) {
				vaults[key] = vault;
			}
		}
		return {vaults, vaultsMigrations, vaultsRetired};
	}, [records, snapshots]);

	return {...data, isLoading, mutate: async () => mutate()};
}
