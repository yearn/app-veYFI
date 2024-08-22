import {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {VEYFI_ABI} from 'app/abi/veYFI.abi';
import {VEYFI_POSITION_HELPER_ABI} from 'app/abi/veYFIPositionHelper.abi';
import {VEYFI_CHAIN_ID} from 'app/utils';
import {erc20Abi} from 'viem';
import {useReadContract, useReadContracts} from 'wagmi';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {isZeroAddress, toAddress} from '@builtbymom/web3/utils';
import {decodeAsBigInt, decodeAsNumber, decodeAsString} from '@builtbymom/web3/utils/decoder';
import {VEYFI_ADDRESS, VEYFI_POSITION_HELPER_ADDRESS, YFI_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {allowanceKey} from '@yearn-finance/web-lib/utils/helpers';
import {toMilliseconds} from '@yearn-finance/web-lib/utils/time';

import type {ReactElement} from 'react';
import type {TMilliseconds} from '@yearn-finance/web-lib/utils/time';
import type {TAddress, TDict} from '@builtbymom/web3/types';

export type TVotingEscrow = {
	address: TAddress;
	token: TAddress;
	name: string;
	symbol: string;
	decimals: number;
	supply: bigint;
	rewardPool: TAddress;
};

export type TPosition = {
	balance: bigint;
	underlyingBalance: bigint;
};

export type TVotingEscrowPosition = {
	deposit?: TPosition;
	unlockTime?: TMilliseconds;
	penalty?: bigint;
	penaltyRatio?: number;
	withdrawable?: bigint;
};

export type TVotingEscrowContext = {
	votingEscrow: TVotingEscrow | undefined;
	positions: TVotingEscrowPosition | undefined;
	allowances: TDict<bigint>;
	isLoading: boolean;
	refresh: VoidFunction;
};
const defaultProps: TVotingEscrowContext = {
	votingEscrow: undefined,
	positions: undefined,
	allowances: {},
	isLoading: true,
	refresh: (): void => undefined
};

const VotingEscrowContext = createContext<TVotingEscrowContext>(defaultProps);
export const VotingEscrowContextApp = memo(function VotingEscrowContextApp({
	children
}: {
	children: ReactElement;
}): ReactElement {
	const {address, isActive} = useWeb3();

	/* 🔵 - Yearn Finance **********************************************************
	 ** Retrieving the basic information of the veYFI contract. They are not linked
	 ** to the user's address, so they are not affected by the `isActive` flag.
	 ******************************************************************************/
	const baseVeYFIContract = {address: VEYFI_ADDRESS, abi: VEYFI_ABI, chainId: VEYFI_CHAIN_ID};
	const {
		data: votingEscrowData,
		status: votingEscrowStatus,
		refetch: refreshVotingEscrow
	} = useReadContracts({
		contracts: [
			{...baseVeYFIContract, functionName: 'token'},
			{...baseVeYFIContract, functionName: 'name'},
			{...baseVeYFIContract, functionName: 'symbol'},
			{...baseVeYFIContract, functionName: 'decimals'},
			{...baseVeYFIContract, functionName: 'supply'},
			{...baseVeYFIContract, functionName: 'reward_pool'}
		]
	});
	const votingEscrow = useMemo((): TVotingEscrow | undefined => {
		if (!votingEscrowData || votingEscrowStatus !== 'success') {
			return undefined;
		}
		const [token, name, symbol, decimals, supply, rewardPool] = votingEscrowData;
		return {
			address: VEYFI_ADDRESS,
			token: toAddress(decodeAsString(token)),
			name: decodeAsString(name),
			symbol: decodeAsString(symbol),
			decimals: decodeAsNumber(decimals) || Number(decodeAsBigInt(decimals)),
			supply: decodeAsBigInt(supply),
			rewardPool: toAddress(decodeAsString(rewardPool))
		};
	}, [votingEscrowData, votingEscrowStatus]);

	/* 🔵 - Yearn Finance **********************************************************
	 ** Retrieving the user's positions in the veYFI contract. They are linked to the
	 ** user's address, so they are affected by the `isActive` flag.
	 ******************************************************************************/
	const baseVeYFIPositionContract = {address: VEYFI_POSITION_HELPER_ADDRESS, abi: VEYFI_POSITION_HELPER_ABI};
	const {
		data: positionData,
		status: positionStatus,
		refetch: refreshPosition
	} = useReadContract({
		...baseVeYFIPositionContract,
		chainId: VEYFI_CHAIN_ID,
		functionName: 'getPositionDetails',
		args: [toAddress(address)],
		query: {
			enabled: isActive && address !== undefined && !isZeroAddress(address)
		}
	});
	const positions = useMemo((): TVotingEscrowPosition | undefined => {
		if (!positionData || positionStatus !== 'success') {
			return undefined;
		}
		const {balance, depositAmount, withdrawable, penalty, unlockTime} = positionData;
		const depositPosition: TPosition = {
			balance: balance,
			underlyingBalance: depositAmount
		};
		return {
			deposit: depositPosition,
			unlockTime: toMilliseconds(Number(unlockTime)),
			penalty: penalty,
			penaltyRatio: depositAmount > 0 ? Number(penalty) / Number(depositAmount) : 0,
			withdrawable: withdrawable
		};
	}, [positionData, positionStatus]);

	/* 🔵 - Yearn Finance **********************************************************
	 ** Retrieving the user's allowances of YFI for the veYFI contract.
	 ******************************************************************************/
	const {
		data: allowance,
		status: allowanceStatus,
		refetch: refreshAllowance
	} = useReadContract({
		address: YFI_ADDRESS,
		abi: erc20Abi,
		chainId: VEYFI_CHAIN_ID,
		functionName: 'allowance',
		args: [toAddress(address), VEYFI_ADDRESS],
		query: {
			enabled: isActive && address !== undefined && !isZeroAddress(address)
		}
	});
	const allowances = useMemo((): TDict<bigint> => {
		if (!address || !allowance || allowanceStatus !== 'success') {
			return {};
		}
		return {
			[allowanceKey(VEYFI_CHAIN_ID, YFI_ADDRESS, VEYFI_ADDRESS, address)]: allowance
		};
	}, [address, allowance, allowanceStatus]);

	const refresh = useCallback((): void => {
		refreshVotingEscrow();
		refreshPosition();
		refreshAllowance();
	}, [refreshVotingEscrow, refreshPosition, refreshAllowance]);

	const contextValue = useMemo(
		(): TVotingEscrowContext => ({
			votingEscrow,
			positions,
			allowances: allowances ?? {},
			isLoading:
				votingEscrowStatus === 'pending' && positionStatus === 'pending' && allowanceStatus === 'pending',
			refresh
		}),
		[votingEscrow, positions, allowances, votingEscrowStatus, positionStatus, allowanceStatus, refresh]
	);

	return <VotingEscrowContext.Provider value={contextValue}>{children}</VotingEscrowContext.Provider>;
});

export const useVotingEscrow = (): TVotingEscrowContext => useContext(VotingEscrowContext);
