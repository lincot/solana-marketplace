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
import { NATIVE_MINT } from "@solana/spl-token";
import {
  findAssociatedTokenAccountPda,
  findAuctionHouseBuyerEscrowPda,
  findAuctionHouseFeePda,
  findAuctionHousePda,
  findAuctionHouseProgramAsSignerPda,
  findAuctionHouseTradeStatePda,
  findAuctionHouseTreasuryPda,
  Nft,
} from "@metaplex-foundation/js";

export async function createAuctionHouse(
  ctx: Context,
  authority: Keypair,
  sellerFeeBasisPoints: number,
  requiresSignOff: boolean,
  canChangeSalePrice: boolean
): Promise<void> {
  const auctionHouse = findAuctionHousePda(authority.publicKey, NATIVE_MINT);
  const auctionHouseFeeAccount = findAuctionHouseFeePda(auctionHouse);
  const auctionHouseTreasury = findAuctionHouseTreasuryPda(auctionHouse);
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
  nft: Nft,
  price: number
): Promise<void> {
  const auctionHouse = findAuctionHousePda(authority, NATIVE_MINT);
  const auctionHouseFeeAccount = findAuctionHouseFeePda(auctionHouse);
  const tokenAccount = findAssociatedTokenAccountPda(
    nft.mint.address,
    seller.publicKey
  );
  const sellerTradeState = findAuctionHouseTradeStatePda(
    auctionHouse,
    seller.publicKey,
    tokenAccount,
    NATIVE_MINT,
    nft.mint.address,
    new BN(price),
    new BN(1)
  );
  const freeSellerTradeState = findAuctionHouseTradeStatePda(
    auctionHouse,
    seller.publicKey,
    tokenAccount,
    NATIVE_MINT,
    nft.mint.address,
    new BN(0),
    new BN(1)
  );
  const programAsSigner = findAuctionHouseProgramAsSignerPda();
  const ix = createSellInstruction(
    {
      wallet: seller.publicKey,
      tokenAccount,
      metadata: nft.metadataAddress,
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
      tokenSize: 1,
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
  nft: Nft,
  price: number
): Promise<void> {
  const auctionHouse = findAuctionHousePda(authority, NATIVE_MINT);
  const auctionHouseFeeAccount = findAuctionHouseFeePda(auctionHouse);
  const tokenAccount = findAssociatedTokenAccountPda(nft.mint.address, seller);
  const escrowPaymentAccount = findAuctionHouseBuyerEscrowPda(
    auctionHouse,
    buyer.publicKey
  );
  const buyerTradeState = findAuctionHouseTradeStatePda(
    auctionHouse,
    buyer.publicKey,
    tokenAccount,
    NATIVE_MINT,
    nft.mint.address,
    new BN(price),
    new BN(1)
  );
  const ix = createBuyInstruction(
    {
      wallet: buyer.publicKey,
      paymentAccount: buyer.publicKey,
      transferAuthority: buyer.publicKey,
      treasuryMint: NATIVE_MINT,
      tokenAccount,
      metadata: nft.metadataAddress,
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
  const auctionHouse = findAuctionHousePda(authority, NATIVE_MINT);
  const auctionHouseFeeAccount = findAuctionHouseFeePda(auctionHouse);
  const escrowPaymentAccount = findAuctionHouseBuyerEscrowPda(
    auctionHouse,
    depositor.publicKey
  );
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
  nft: Nft,
  price: number
): Promise<void> {
  const auctionHouse = findAuctionHousePda(authority, NATIVE_MINT);
  const auctionHouseFeeAccount = findAuctionHouseFeePda(auctionHouse);
  const auctionHouseTreasury = findAuctionHouseTreasuryPda(auctionHouse);
  const tokenAccount = findAssociatedTokenAccountPda(nft.mint.address, seller);
  const escrowPaymentAccount = findAuctionHouseBuyerEscrowPda(
    auctionHouse,
    buyer.publicKey
  );
  const buyerTradeState = findAuctionHouseTradeStatePda(
    auctionHouse,
    buyer.publicKey,
    tokenAccount,
    NATIVE_MINT,
    nft.mint.address,
    new BN(price),
    new BN(1)
  );
  const sellerTradeState = findAuctionHouseTradeStatePda(
    auctionHouse,
    seller,
    tokenAccount,
    NATIVE_MINT,
    nft.mint.address,
    new BN(price),
    new BN(1)
  );
  const freeTradeState = findAuctionHouseTradeStatePda(
    auctionHouse,
    seller,
    tokenAccount,
    NATIVE_MINT,
    nft.mint.address,
    new BN(0),
    new BN(1)
  );
  const programAsSigner = findAuctionHouseProgramAsSignerPda();
  const ix = createExecuteSaleInstruction(
    {
      buyer: buyer.publicKey,
      seller,
      tokenAccount,
      tokenMint: nft.mint.address,
      metadata: nft.metadataAddress,
      treasuryMint: NATIVE_MINT,
      escrowPaymentAccount,
      sellerPaymentReceiptAccount: seller,
      buyerReceiptTokenAccount: findAssociatedTokenAccountPda(
        nft.mint.address,
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
  for (let creator of nft.creators) {
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
  const auctionHouse = findAuctionHousePda(authority.publicKey, NATIVE_MINT);
  const auctionHouseTreasury = findAuctionHouseTreasuryPda(auctionHouse);
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
