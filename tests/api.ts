import { BN } from "@project-serum/anchor";
import {
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
} from "@solana/web3.js";
import { Context } from "./ctx";
import {
  createBuyInstruction,
  createCreateAuctionHouseInstruction,
  createDepositInstruction,
  createExecuteSaleInstruction,
  createSellInstruction,
  createWithdrawFromTreasuryInstruction,
} from "@metaplex-foundation/mpl-auction-house";
import { NATIVE_MINT, getAssociatedTokenAddress } from "@solana/spl-token";
import { Creator, BigNumber } from "@metaplex-foundation/js";

export async function createAuctionHouse(
  ctx: Context,
  authority: Keypair,
  sellerFeeBasisPoints: number,
  requiresSignOff: boolean,
  canChangeSalePrice: boolean
): Promise<void> {
  const auctionHouse = ctx.auctionHousePdasClient.auctionHouse({
    creator: authority.publicKey,
    treasuryMint: NATIVE_MINT,
  });
  const auctionHouseFeeAccount = ctx.auctionHousePdasClient.fee({
    auctionHouse,
  });
  const auctionHouseTreasury = ctx.auctionHousePdasClient.treasury({
    auctionHouse,
  });
  const ix = createCreateAuctionHouseInstruction(
    {
      treasuryMint: NATIVE_MINT,
      payer: authority.publicKey,
      authority: authority.publicKey,
      feeWithdrawalDestination: authority.publicKey,
      treasuryWithdrawalDestination: authority.publicKey,
      treasuryWithdrawalDestinationOwner: authority.publicKey,
      auctionHouse,
      auctionHouseFeeAccount,
      auctionHouseTreasury,
    },
    {
      bump: auctionHouse.bump,
      feePayerBump: auctionHouseFeeAccount.bump,
      treasuryBump: auctionHouseTreasury.bump,
      sellerFeeBasisPoints,
      requiresSignOff,
      canChangeSalePrice,
    }
  );
  const fillTreasuryWithRentIx = SystemProgram.transfer({
    fromPubkey: authority.publicKey,
    toPubkey: auctionHouseTreasury,
    lamports: await ctx.provider.connection.getMinimumBalanceForRentExemption(
      0
    ),
  });
  await sendAndConfirmTransaction(
    ctx.provider.connection,
    new Transaction().add(ix, fillTreasuryWithRentIx),
    [authority]
  );
}

export async function sell(
  ctx: Context,
  authority: PublicKey,
  seller: Keypair,
  mint: PublicKey,
  metadata: PublicKey,
  price: number | BN,
  amount: number | BN
): Promise<void> {
  const auctionHouse = ctx.auctionHousePdasClient.auctionHouse({
    creator: authority,
    treasuryMint: NATIVE_MINT,
  });
  const auctionHouseFeeAccount = ctx.auctionHousePdasClient.fee({
    auctionHouse,
  });
  const tokenAccount = await getAssociatedTokenAddress(mint, seller.publicKey);
  const sellerTradeState = ctx.auctionHousePdasClient.tradeState({
    auctionHouse,
    wallet: seller.publicKey,
    tokenAccount,
    treasuryMint: NATIVE_MINT,
    tokenMint: mint,
    price: new BN(price) as BigNumber,
    tokenSize: new BN(amount) as BigNumber,
  });
  const freeSellerTradeState = ctx.auctionHousePdasClient.tradeState({
    auctionHouse,
    wallet: seller.publicKey,
    tokenAccount,
    treasuryMint: NATIVE_MINT,
    tokenMint: mint,
    price: new BN(0) as BigNumber,
    tokenSize: new BN(amount) as BigNumber,
  });
  const programAsSigner = ctx.auctionHousePdasClient.programAsSigner();
  const ix = createSellInstruction(
    {
      wallet: seller.publicKey,
      tokenAccount,
      metadata,
      authority,
      auctionHouse,
      auctionHouseFeeAccount,
      sellerTradeState,
      freeSellerTradeState,
      programAsSigner,
    },
    {
      tradeStateBump: sellerTradeState.bump,
      freeTradeStateBump: freeSellerTradeState.bump,
      programAsSignerBump: programAsSigner.bump,
      buyerPrice: price,
      tokenSize: amount,
    }
  );
  await sendAndConfirmTransaction(
    ctx.provider.connection,
    new Transaction().add(ix),
    [seller]
  );
}

export async function buy(
  ctx: Context,
  authority: PublicKey,
  seller: PublicKey,
  buyer: Keypair,
  mint: PublicKey,
  metadata: PublicKey,
  price: number | BN,
  amount: number | BN
): Promise<void> {
  const auctionHouse = ctx.auctionHousePdasClient.auctionHouse({
    creator: authority,
    treasuryMint: NATIVE_MINT,
  });
  const auctionHouseFeeAccount = ctx.auctionHousePdasClient.fee({
    auctionHouse,
  });
  const tokenAccount = await getAssociatedTokenAddress(mint, seller);
  const escrowPaymentAccount = ctx.auctionHousePdasClient.buyerEscrow({
    auctionHouse,
    buyer: buyer.publicKey,
  });
  const buyerTradeState = ctx.auctionHousePdasClient.tradeState({
    auctionHouse,
    wallet: buyer.publicKey,
    tokenAccount,
    treasuryMint: NATIVE_MINT,
    tokenMint: mint,
    price: new BN(price) as BigNumber,
    tokenSize: new BN(amount) as BigNumber,
  });
  const ix = createBuyInstruction(
    {
      wallet: buyer.publicKey,
      paymentAccount: buyer.publicKey,
      transferAuthority: buyer.publicKey,
      treasuryMint: NATIVE_MINT,
      tokenAccount,
      metadata,
      escrowPaymentAccount,
      authority,
      auctionHouse,
      auctionHouseFeeAccount,
      buyerTradeState,
    },
    {
      tradeStateBump: buyerTradeState.bump,
      escrowPaymentBump: escrowPaymentAccount.bump,
      buyerPrice: price,
      tokenSize: 1,
    }
  );
  await sendAndConfirmTransaction(
    ctx.provider.connection,
    new Transaction().add(ix),
    [buyer]
  );
}

export async function deposit(
  ctx: Context,
  authority: PublicKey,
  depositor: Keypair,
  amount: number
): Promise<void> {
  const auctionHouse = ctx.auctionHousePdasClient.auctionHouse({
    creator: authority,
    treasuryMint: NATIVE_MINT,
  });
  const auctionHouseFeeAccount = ctx.auctionHousePdasClient.fee({
    auctionHouse,
  });
  const escrowPaymentAccount = ctx.auctionHousePdasClient.buyerEscrow({
    auctionHouse,
    buyer: depositor.publicKey,
  });
  const ix = createDepositInstruction(
    {
      wallet: depositor.publicKey,
      paymentAccount: depositor.publicKey,
      transferAuthority: depositor.publicKey,
      escrowPaymentAccount,
      treasuryMint: NATIVE_MINT,
      authority,
      auctionHouse,
      auctionHouseFeeAccount,
    },
    {
      escrowPaymentBump: escrowPaymentAccount.bump,
      amount: amount,
    }
  );
  await sendAndConfirmTransaction(
    ctx.provider.connection,
    new Transaction().add(ix),
    [depositor]
  );
}

export async function executeSale(
  ctx: Context,
  authority: PublicKey,
  seller: PublicKey,
  buyer: Keypair,
  mint: PublicKey,
  metadata: PublicKey,
  price: number,
  amount: number | BN,
  creators: Creator[]
): Promise<void> {
  const auctionHouse = ctx.auctionHousePdasClient.auctionHouse({
    creator: authority,
    treasuryMint: NATIVE_MINT,
  });
  const auctionHouseFeeAccount = ctx.auctionHousePdasClient.fee({
    auctionHouse,
  });
  const auctionHouseTreasury = ctx.auctionHousePdasClient.treasury({
    auctionHouse,
  });
  const tokenAccount = await getAssociatedTokenAddress(mint, seller);
  const escrowPaymentAccount = ctx.auctionHousePdasClient.buyerEscrow({
    auctionHouse,
    buyer: buyer.publicKey,
  });
  const buyerTradeState = ctx.auctionHousePdasClient.tradeState({
    auctionHouse,
    wallet: buyer.publicKey,
    tokenAccount,
    treasuryMint: NATIVE_MINT,
    tokenMint: mint,
    price: new BN(price) as BigNumber,
    tokenSize: new BN(amount) as BigNumber,
  });
  const sellerTradeState = ctx.auctionHousePdasClient.tradeState({
    auctionHouse,
    wallet: seller,
    tokenAccount,
    treasuryMint: NATIVE_MINT,
    tokenMint: mint,
    price: new BN(price) as BigNumber,
    tokenSize: new BN(amount) as BigNumber,
  });
  const freeTradeState = ctx.auctionHousePdasClient.tradeState({
    auctionHouse,
    wallet: seller,
    tokenAccount,
    treasuryMint: NATIVE_MINT,
    tokenMint: mint,
    price: new BN(0) as BigNumber,
    tokenSize: new BN(amount) as BigNumber,
  });
  const programAsSigner = ctx.auctionHousePdasClient.programAsSigner();
  const ix = createExecuteSaleInstruction(
    {
      buyer: buyer.publicKey,
      seller,
      tokenAccount,
      tokenMint: mint,
      metadata,
      treasuryMint: NATIVE_MINT,
      escrowPaymentAccount,
      sellerPaymentReceiptAccount: seller,
      buyerReceiptTokenAccount: await getAssociatedTokenAddress(
        mint,
        buyer.publicKey
      ),
      authority,
      auctionHouse,
      auctionHouseFeeAccount,
      auctionHouseTreasury,
      buyerTradeState,
      sellerTradeState,
      freeTradeState,
      programAsSigner,
    },
    {
      escrowPaymentBump: escrowPaymentAccount.bump,
      freeTradeStateBump: freeTradeState.bump,
      programAsSignerBump: programAsSigner.bump,
      buyerPrice: price,
      tokenSize: 1,
    }
  );
  for (let creator of creators) {
    ix.keys = ix.keys.concat([
      { pubkey: creator.address, isSigner: false, isWritable: true },
    ]);
  }
  await sendAndConfirmTransaction(
    ctx.provider.connection,
    new Transaction().add(ix),
    [buyer]
  );
}

export async function withdrawFromTreasury(
  ctx: Context,
  authority: Keypair
): Promise<void> {
  const auctionHouse = ctx.auctionHousePdasClient.auctionHouse({
    creator: authority.publicKey,
    treasuryMint: NATIVE_MINT,
  });
  const auctionHouseTreasury = ctx.auctionHousePdasClient.treasury({
    auctionHouse,
  });
  const amount =
    (await ctx.provider.connection.getBalance(auctionHouseTreasury)) -
    (await ctx.provider.connection.getMinimumBalanceForRentExemption(0));

  const ix = createWithdrawFromTreasuryInstruction(
    {
      treasuryMint: NATIVE_MINT,
      authority: authority.publicKey,
      treasuryWithdrawalDestination: authority.publicKey,
      auctionHouseTreasury,
      auctionHouse,
    },
    { amount }
  );
  await sendAndConfirmTransaction(
    ctx.provider.connection,
    new Transaction().add(ix),
    [authority]
  );
}
