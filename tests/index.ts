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

chai.use(chaiAsPromised);

const ctx = new Context();

before(async () => {
  await ctx.setup();
});

describe("NFT marketplace", () => {
  it("CreateAuctionHouse", async () => {
    await createAuctionHouse(ctx, ctx.auctionHouseAuthority, 100, false, false);
  });

  it("Sell", async () => {
    await sell(
      ctx,
      ctx.auctionHouseAuthority.publicKey,
      ctx.seller,
      ctx.nft,
      100_000
    );
  });

  it("Buy", async () => {
    await buy(
      ctx,
      ctx.auctionHouseAuthority.publicKey,
      ctx.seller.publicKey,
      ctx.buyer,
      ctx.nft,
      100_000
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
      ctx.nft,
      100_000
    );
  });

  it("WithdrawFromTreasury", async () => {
    await withdrawFromTreasury(ctx, ctx.auctionHouseAuthority);
  });
});
