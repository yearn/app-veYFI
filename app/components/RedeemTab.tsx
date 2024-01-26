import {useCallback, useState} from 'react';
import {redeem} from 'app/actions';
import {useOption} from 'app/contexts/useOption';
import {useBalance} from 'app/hooks/useBalance';
import {validateAmount, VEYFI_CHAIN_ID, VEYFI_DYFI_ADDRESS, VEYFI_OPTIONS_ADDRESS} from 'app/utils';
import {erc20ABI, useContractRead} from 'wagmi';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {useAsyncTrigger} from '@builtbymom/web3/hooks/useAsyncTrigger';
import {
	formatAmount,
	formatCounterValue,
	handleInputChangeValue,
	toAddress,
	toNormalizedBN
} from '@builtbymom/web3/utils';
import {ETH_TOKEN_ADDRESS, YFI_ADDRESS} from '@builtbymom/web3/utils/constants';
import {defaultTxStatus} from '@builtbymom/web3/utils/wagmi';
import {approveERC20} from '@builtbymom/web3/utils/wagmi/actions';
import {AmountInput} from '@yearn-finance/web-lib/components/AmountInput';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useYearnWallet} from '@yearn-finance/web-lib/contexts/useYearnWallet';
import {useYearnToken} from '@yearn-finance/web-lib/hooks/useYearnToken';
import {useYearnTokenPrice} from '@yearn-finance/web-lib/hooks/useYearnTokenPrice';

import type {ReactElement} from 'react';

export function RedeemTab(): ReactElement {
	const [redeemAmount, set_redeemAmount] = useState(toNormalizedBN(0));
	const {provider, address, isActive} = useWeb3();
	const {onRefresh: refreshBalances} = useYearnWallet();
	const {getRequiredEth, position: dYFIBalance, discount, refresh, dYFIPrice} = useOption();
	const clearLockAmount = (): void => set_redeemAmount(toNormalizedBN(0));
	const ethBalance = useYearnToken({address: ETH_TOKEN_ADDRESS, chainID: VEYFI_CHAIN_ID}); //VeYFI is on ETH mainnet only
	const yfiBalance = useBalance({address: YFI_ADDRESS, chainID: VEYFI_CHAIN_ID}); //VeYFI is on ETH mainnet only
	const yfiPrice = useYearnTokenPrice({address: YFI_ADDRESS, chainID: VEYFI_CHAIN_ID});
	const [approveRedeemStatus, set_approveRedeemStatus] = useState(defaultTxStatus);
	const [redeemStatus, set_redeemStatus] = useState(defaultTxStatus);
	const [ethRequired, set_ethRequired] = useState(toNormalizedBN(0));

	const {data: isApproved, refetch: refreshAllowances} = useContractRead({
		address: VEYFI_DYFI_ADDRESS,
		abi: erc20ABI,
		chainId: VEYFI_CHAIN_ID,
		functionName: 'allowance',
		args: [toAddress(address), VEYFI_OPTIONS_ADDRESS],
		select: (value: bigint): boolean => value >= redeemAmount.raw
	});

	const refreshData = useCallback(
		(): unknown => Promise.all([refresh(), refreshAllowances(), refreshBalances()]),
		[refresh, refreshBalances, refreshAllowances]
	);

	const onTxSuccess = useCallback((): unknown => Promise.all([refreshData(), clearLockAmount()]), [refreshData]);

	useAsyncTrigger(async (): Promise<void> => {
		const result = await getRequiredEth(redeemAmount.raw);
		set_ethRequired(toNormalizedBN(result));
	}, [getRequiredEth, redeemAmount.raw]);

	const onApproveRedeem = useCallback(async (): Promise<void> => {
		const response = await approveERC20({
			connector: provider,
			chainID: VEYFI_CHAIN_ID,
			contractAddress: VEYFI_DYFI_ADDRESS,
			spenderAddress: VEYFI_OPTIONS_ADDRESS,
			statusHandler: set_approveRedeemStatus,
			amount: redeemAmount.raw
		});

		if (response.isSuccessful) {
			await refreshData();
		}
	}, [provider, redeemAmount.raw, refreshData]);

	const onRedeem = useCallback(async (): Promise<void> => {
		const response = await redeem({
			connector: provider,
			chainID: VEYFI_CHAIN_ID,
			contractAddress: VEYFI_OPTIONS_ADDRESS,
			statusHandler: set_redeemStatus,
			accountAddress: toAddress(address),
			amount: redeemAmount.raw,
			ethRequired: ethRequired.raw
		});

		if (response.isSuccessful) {
			await onTxSuccess();
		}
	}, [address, onTxSuccess, provider, redeemAmount.raw, ethRequired.raw]);

	const {isValid: isValidRedeemAmount, error: redeemAmountError} = validateAmount({
		amount: redeemAmount.normalized,
		balance: dYFIBalance.normalized
	});

	const onChangeInput = useCallback((value: string): void => {
		set_redeemAmount(handleInputChangeValue(value, 18));
	}, []);

	return (
		<div className={'flex flex-col gap-6 md:gap-10'}>
			<div className={'flex flex-col'}>
				<div className={'flex flex-col gap-4'}>
					<h2 className={'m-0 text-2xl font-bold'}>{'Redeem'}</h2>
					<div className={'text-neutral-600'}>
						<p className={'w-2/3 whitespace-break-spaces'}>
							{
								'Got dYFI, want YFI? You’ve come to the right place. Redeem dYFI for YFI by paying the redemption cost in ETH. Enjoy your cheap YFI anon.'
							}
						</p>
						<b
							suppressHydrationWarning
							className={'mt-4 block'}>
							{`Current discount: ${formatAmount(Number(discount.normalized) * 100, 2, 2)}%`}
						</b>
					</div>
				</div>

				<div className={'mt-10 grid grid-cols-1 gap-4 md:grid-cols-4'}>
					<AmountInput
						label={'dYFI to use'}
						amount={redeemAmount}
						maxAmount={dYFIBalance}
						onAmountChange={onChangeInput}
						onLegendClick={(): void => set_redeemAmount(dYFIBalance)}
						onMaxClick={(): void => set_redeemAmount(dYFIBalance)}
						error={redeemAmountError}
						legend={
							<div className={'flex flex-row justify-between'}>
								<p
									suppressHydrationWarning
									className={'text-neutral-400'}>
									{formatCounterValue(redeemAmount.normalized, dYFIPrice)}
								</p>
								<p
									suppressHydrationWarning
									className={'text-neutral-400'}>{`You have: ${formatAmount(
									dYFIBalance.normalized,
									2,
									6
								)} dYFI`}</p>
							</div>
						}
					/>

					<AmountInput
						label={'Redemption cost (in ETH)'}
						amount={ethRequired}
						legend={
							<div className={'flex flex-row justify-between'}>
								<p
									suppressHydrationWarning
									className={'text-neutral-400'}>
									{formatCounterValue(
										ethRequired.normalized,
										Number(ethBalance.price.normalized) ?? 0
									)}
								</p>
								<p
									suppressHydrationWarning
									className={'text-neutral-400'}>{`You have: ${formatAmount(
									ethBalance.balance.normalized,
									2,
									6
								)} ETH`}</p>
							</div>
						}
						disabled
					/>

					<AmountInput
						label={'Redeems YFI'}
						amount={redeemAmount}
						legend={
							<div className={'flex flex-row justify-between'}>
								<p
									suppressHydrationWarning
									className={'text-neutral-400'}>
									{formatCounterValue(redeemAmount.normalized, yfiPrice)}
								</p>
								<p
									suppressHydrationWarning
									className={'text-neutral-400'}>{`You have: ${formatAmount(
									yfiBalance.normalized,
									2,
									6
								)} YFI`}</p>
							</div>
						}
						disabled
					/>
					<Button
						className={'w-full md:mt-7'}
						onClick={async (): Promise<void> => (isApproved ? onRedeem() : onApproveRedeem())}
						isBusy={approveRedeemStatus.pending || redeemStatus.pending}
						isDisabled={
							!isActive || !isValidRedeemAmount || !redeemStatus.none || !approveRedeemStatus.none
						}>
						{isApproved ? 'Redeem' : 'Approve'}
					</Button>
				</div>
			</div>
		</div>
	);
}
