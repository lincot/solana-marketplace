import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { Context } from "./ctx";
import {
  buy,
  createAuctionHouse,
  deposit,
  executeSale,
  sell,
  withdrawFromTreasury,
} from "./api";
import { keypairIdentity, Nft } from "@metaplex-foundation/js";
import * as token from "@solana/spl-token";
import {
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";

chai.use(chaiAsPromised);

const ctx = new Context();

before(async () => {
  await ctx.setup();
});

describe("Auction House", () => {
  it("CreateAuctionHouse", async () => {
    await createAuctionHouse(ctx, ctx.auctionHouseAuthority, 100, false, false);
  });
});

describe("NFT marketplace", () => {
  let mint: PublicKey;
  let metadata: PublicKey;

  it("Sell", async () => {
    const nft = (
      await ctx.metaplex.use(keypairIdentity(ctx.seller)).nfts().create({
        uri: "https://arweave.net/123",
        name: "My NFT",
        sellerFeeBasisPoints: 100,
      })
    ).nft;
    mint = nft.mint.address;
    metadata = nft.metadataAddress;

    await sell(
      ctx,
      ctx.auctionHouseAuthority.publicKey,
      ctx.seller,
      mint,
      metadata,
      100_000,
      1
    );
  });

  it("Buy", async () => {
    await buy(
      ctx,
      ctx.auctionHouseAuthority.publicKey,
      ctx.seller.publicKey,
      ctx.buyer,
      mint,
      metadata,
      100_000,
      1,
      1
    );
  });

  it("Deposit", async () => {
    await deposit(
      ctx,
      ctx.auctionHouseAuthority.publicKey,
      ctx.buyer,
      10_000_000
    );
  });

  it("ExecuteSale", async () => {
    await executeSale(
      ctx,
      ctx.auctionHouseAuthority.publicKey,
      ctx.seller.publicKey,
      ctx.buyer,
      mint,
      metadata,
      100_000,
      1,
      1,
      [ctx.seller.publicKey]
    );
  });

  it("WithdrawFromTreasury", async () => {
    await withdrawFromTreasury(ctx, ctx.auctionHouseAuthority);
  });
});

describe("SFT marketplace", () => {
  let mint: PublicKey;
  let metadata: PublicKey;

  it("Sell", async () => {
    mint = await token.createMint(
      ctx.provider.connection,
      ctx.payer,
      ctx.seller.publicKey,
      undefined,
      0
    );
    metadata = ctx.metaplex.nfts().pdas().metadata({ mint });

    await token.mintTo(
      ctx.provider.connection,
      ctx.payer,

      mint,
      (
        await getOrCreateAssociatedTokenAccount(
          ctx.provider.connection,
          ctx.payer,
          mint,
          ctx.seller.publicKey
        )
      ).address,
      ctx.seller,
      1000
    );

    const createMetadataIx = createCreateMetadataAccountV3Instruction(
      {
        metadata,
        mint,
        mintAuthority: ctx.seller.publicKey,
        payer: ctx.seller.publicKey,
        updateAuthority: ctx.seller.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          collectionDetails: null,
          data: {
            name: "Wood",
            symbol: "WOOD",
            uri: "https://wood.wood",
            sellerFeeBasisPoints: 0,
            creators: [
              { address: ctx.seller.publicKey, share: 100, verified: true },
            ],
            collection: null,
            uses: null,
          },
          isMutable: false,
        },
      }
    );
    const tx = new Transaction().add(createMetadataIx);
    await sendAndConfirmTransaction(ctx.provider.connection, tx, [ctx.seller]);

    await sell(
      ctx,
      ctx.auctionHouseAuthority.publicKey,
      ctx.seller,
      mint,
      metadata,
      100_000,
      1000
    );
  });

  it("Buy", async () => {
    await buy(
      ctx,
      ctx.auctionHouseAuthority.publicKey,
      ctx.seller.publicKey,
      ctx.buyer,
      mint,
      metadata,
      100_000,
      1000,
      1
    );
  });

  it("Deposit", async () => {
    await deposit(
      ctx,
      ctx.auctionHouseAuthority.publicKey,
      ctx.buyer,
      10_000_000
    );
  });

  it("ExecuteSale", async () => {
    await executeSale(
      ctx,
      ctx.auctionHouseAuthority.publicKey,
      ctx.seller.publicKey,
      ctx.buyer,
      mint,
      metadata,
      100_000,
      1000,
      1,
      [ctx.seller.publicKey]
    );
  });

  it("WithdrawFromTreasury", async () => {
    await withdrawFromTreasury(ctx, ctx.auctionHouseAuthority);
  });
});
