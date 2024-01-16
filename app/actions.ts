import {VEYFI_CLAIM_REWARDS_ZAP_ABI} from 'app/abi/veYFIClaimRewardsZap.abi';
import {VEYFI_GAUGE_ABI} from 'app/abi/veYFIGauge.abi';
import {BaseError} from 'viem';
import {erc20ABI} from 'wagmi';
import {prepareWriteContract, readContract} from '@wagmi/core';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {assert} from '@yearn-finance/web-lib/utils/assert';
import {handleTx, toWagmiProvider} from '@yearn-finance/web-lib/utils/wagmi/provider';
import {assertAddress} from '@yearn-finance/web-lib/utils/wagmi/utils';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';

import {VEYFI_ABI} from './abi/veYFI.abi';
import {VEYFI_OPTIONS_ABI} from './abi/veYFIOptions.abi';
import {YFI_REWARD_POOL_ABI} from './abi/YFIRewardPool.abi';

import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TWriteTransaction} from '@yearn-finance/web-lib/utils/wagmi/provider';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {Connector} from '@wagmi/core';

/* 🔵 - Yearn Finance **********************************************************
 ** allowanceOf is a _VIEW_ function that returns the amount of a token that is
 ** approved for a spender.
 ******************************************************************************/
type TAllowanceOf = {
	connector: Connector | undefined;
	chainID: number;
	tokenAddress: TAddress;
	spenderAddress: TAddress;
};
export async function allowanceOf(props: TAllowanceOf): Promise<bigint> {
	const wagmiProvider = await toWagmiProvider(props.connector);
	const result = await readContract({
		...wagmiProvider,
		chainId: props.chainID,
		abi: erc20ABI,
		address: props.tokenAddress,
		functionName: 'allowance',
		args: [wagmiProvider.address, props.spenderAddress]
	});
	return result || 0n;
}

/* 🔵 - Yearn Finance **********************************************************
 ** lockVeYFI is a _WRITE_ function that locks funds in the veYFI contract in
 ** exchange of some voting power.
 **
 ** @app - veYFI
 ** @param amount - The amount of the underlying asset to deposit.
 ** @param time - The amount of time to lock the funds for.
 ******************************************************************************/
type TLockVeYFI = TWriteTransaction & {
	amount: bigint;
	time: bigint;
};
export async function lockVeYFI(props: TLockVeYFI): Promise<TTxResponse> {
	assert(props.connector, 'No connector');
	assert(props.time > 0n, 'Time is 0');
	assert(props.amount > 0n, 'Amount is 0');
	assertAddress(props.contractAddress);

	const signerAddress = await props.connector.getAccount();
	assertAddress(signerAddress, 'signerAddress');

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_ABI,
		functionName: 'modify_lock',
		args: [props.amount, props.time, signerAddress]
	});
}

/* 🔵 - Yearn Finance **********************************************************
 ** increaseVeYFILockAmount is a _WRITE_ function that increases the amount of
 ** funds locked in the veYFI contract in exchange of some voting power.
 **
 ** @app - veYFI
 ** @param amount - The amount of the underlying asset to deposit.
 ******************************************************************************/
type TIncreaseVeYFILockAmount = TWriteTransaction & {
	amount: bigint;
};
export async function increaseVeYFILockAmount(props: TIncreaseVeYFILockAmount): Promise<TTxResponse> {
	assert(props.connector, 'No connector');
	assert(props.amount > 0n, 'Amount is 0');
	assertAddress(props.contractAddress);

	const signerAddress = await props.connector.getAccount();
	assertAddress(signerAddress, 'signerAddress');

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_ABI,
		functionName: 'modify_lock',
		args: [props.amount, 0n, signerAddress]
	});
}

/* 🔵 - Yearn Finance **********************************************************
 ** extendVeYFILockTime is a _WRITE_ function that increases the amount of time funds
 ** are locked in the veYFI contract in exchange of some voting power.
 **
 ** @app - veYFI
 ** @param time - The amount of time to lock the funds for.
 ******************************************************************************/
type TExtendVeYFILockTime = TWriteTransaction & {
	time: bigint;
};
export async function extendVeYFILockTime(props: TExtendVeYFILockTime): Promise<TTxResponse> {
	assert(props.connector, 'No connector');
	assert(props.time > 0n, 'Time is 0');
	assertAddress(props.contractAddress);

	const signerAddress = await props.connector.getAccount();
	assertAddress(signerAddress, 'signerAddress');

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_ABI,
		functionName: 'modify_lock',
		args: [0n, props.time, signerAddress]
	});
}

/* 🔵 - Yearn Finance **********************************************************
 ** getVeYFIWithdrawPenalty is a _READ_ function that simulates a withdrawal from
 ** the veYFI contract and returns the penalty to be paid.
 **
 ** @app - veYFI
 ******************************************************************************/
type TGetVeYFIWithdrawPenalty = TWriteTransaction;
export async function getVeYFIWithdrawPenalty(props: TGetVeYFIWithdrawPenalty): Promise<bigint> {
	try {
		const {result} = await prepareWriteContract({
			address: toAddress(props.contractAddress),
			chainId: props.chainID,
			abi: VEYFI_ABI,
			functionName: 'withdraw'
		});
		return result.penalty;
	} catch (error) {
		return 0n;
	}
}

/* 🔵 - Yearn Finance **********************************************************
 ** withdrawUnlockedVeYFI is a _WRITE_ function that withdraws unlocked funds from
 ** the veYFI contract.
 ** Note: will fail if there is a penalty to be paid.
 **
 ** @app - veYFI
 ******************************************************************************/
type TWithdrawUnlockedVeYFI = TWriteTransaction;
export async function withdrawUnlockedVeYFI(props: TWithdrawUnlockedVeYFI): Promise<TTxResponse> {
	assertAddress(props.contractAddress);

	props.statusHandler?.({...defaultTxStatus, pending: true});
	const penalty = await getVeYFIWithdrawPenalty(props);
	if (penalty > 0n) {
		props.statusHandler?.({...defaultTxStatus, error: true});
		setTimeout((): void => {
			props.statusHandler?.({...defaultTxStatus});
		}, 3000);
		return {isSuccessful: false, error: new BaseError('Tokens are not yet unlocked')};
	}

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_ABI,
		functionName: 'withdraw'
	});
}

/* 🔵 - Yearn Finance **********************************************************
 ** withdrawLockedVeYFI is a _WRITE_ function that withdraws locked funds from the
 ** veYFI contract.
 **
 ** @app - veYFI
 ******************************************************************************/
type TWithdrawLockedVeYFI = TWriteTransaction;
export async function withdrawLockedVeYFI(props: TWithdrawLockedVeYFI): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_ABI,
		functionName: 'withdraw'
	});
}

/* 🔵 - Yearn Finance **********************************************************
 ** approveAndStake is a _WRITE_ function that approves the veYFI contract to
 ** spend the underlying asset and then stakes it.
 **
 ** @app - veYFI
 ******************************************************************************/
type TApproveAndStake = TWriteTransaction & {
	vaultAddress: TAddress;
	amount: bigint;
};
export async function approveAndStake(props: TApproveAndStake): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assertAddress(props.vaultAddress);
	assert(props.amount > 0n, 'Amount is 0');

	const allowance = await allowanceOf({
		connector: props.connector,
		chainID: props.chainID,
		tokenAddress: props.vaultAddress,
		spenderAddress: toAddress(props.contractAddress)
	});

	if (allowance < props.amount) {
		try {
			await handleTx(props, {
				address: props.vaultAddress,
				abi: erc20ABI,
				functionName: 'approve',
				args: [props.contractAddress, props.amount]
			});
		} catch (error) {
			return {isSuccessful: false, error: error};
		}
	}

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_GAUGE_ABI,
		functionName: 'deposit',
		args: [props.amount]
	});
}

/* 🔵 - Yearn Finance **********************************************************
 ** stake is a _WRITE_ function that stakes a given amount of the underlying
 ** asset.
 **
 ** @app - veYFI
 ******************************************************************************/
type TStake = TWriteTransaction & {
	amount: bigint;
};
export async function stake(props: TStake): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assert(props.amount > 0n, 'Amount is 0');

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_GAUGE_ABI,
		functionName: 'deposit',
		args: [props.amount]
	});
}

/* 🔵 - Yearn Finance **********************************************************
 ** unstake is a _WRITE_ function that unstakes a given amount of the underlying
 ** asset.
 **
 ** @app - veYFI
 ******************************************************************************/
type TUnstake = TWriteTransaction & {
	accountAddress: TAddress;
	amount: bigint;
};
export async function unstake(props: TUnstake): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assertAddress(props.accountAddress);
	assert(props.amount > 0n, 'Amount is 0');

	const willClaim = false;

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_GAUGE_ABI,
		functionName: 'withdraw',
		args: [props.amount, props.accountAddress, props.accountAddress, willClaim]
	});
}

/* 🔵 - Yearn Finance **********************************************************
 ** claimRewards is a _WRITE_ function that claims rewards from the veYFI
 ** contract.
 **
 ** @app - veYFI
 ******************************************************************************/
type TClaimRewards = TWriteTransaction;
export async function claimRewards(props: TClaimRewards): Promise<TTxResponse> {
	assertAddress(props.contractAddress);

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_GAUGE_ABI,
		functionName: 'getReward'
	});
}

/* 🔵 - Yearn Finance **********************************************************
 ** claimBoostRewards is a _WRITE_ function that claims rewards from the veYFI
 ** contract.
 **
 ** @app - veYFI
 ******************************************************************************/
type TClaimBoostRewards = TWriteTransaction;
export async function claimBoostRewards(props: TClaimBoostRewards): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	const wagmiProvider = await toWagmiProvider(props.connector);
	assertAddress(wagmiProvider.address, 'ownerAddress');

	return await handleTx(props, {
		address: props.contractAddress,
		abi: YFI_REWARD_POOL_ABI,
		functionName: 'claim',
		args: [wagmiProvider.address]
	});
}

/* 🔵 - Yearn Finance **********************************************************
 ** claimAllRewards is a _WRITE_ function that claims all the rewards.
 **
 ** @app - veYFI
 ******************************************************************************/
type TClaimAllRewards = TWriteTransaction & {
	gaugeAddresses: TAddress[];
	willLockRewards: boolean;
	claimVotingEscrow?: boolean;
};
export async function claimAllRewards(props: TClaimAllRewards): Promise<TTxResponse> {
	assertAddress(props.contractAddress, 'contractAddress');
	for (const addr of props.gaugeAddresses) {
		assertAddress(addr);
	}

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_CLAIM_REWARDS_ZAP_ABI,
		functionName: 'claim',
		args: [props.gaugeAddresses, props.willLockRewards, props.claimVotingEscrow]
	});
}

/* 🔵 - Yearn Finance **********************************************************
 ** redeem is a _WRITE_ function that redeems a given amount of the underlying
 ** asset.
 ** @app - veYFI
 ******************************************************************************/
type TRedeem = TWriteTransaction & {
	accountAddress: TAddress;
	amount: bigint;
	ethRequired: bigint;
};
export async function redeem(props: TRedeem): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assertAddress(props.accountAddress);
	assert(props.amount > 0n, 'amount is zero');
	assert(props.ethRequired > 0n, 'ethRequired is zero');

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_OPTIONS_ABI,
		functionName: 'redeem',
		value: props.ethRequired,
		args: [props.amount, props.accountAddress]
	});
}
