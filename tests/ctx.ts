import * as anchor from "@project-serum/anchor";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import { Keypair } from "@solana/web3.js";
import { airdrop } from "./utils";
import { keypairIdentity, Metaplex, Nft } from "@metaplex-foundation/js";

export class Context {
  provider: anchor.AnchorProvider;
  metaplex: Metaplex;

  payer: Keypair;

  auctionHouseAuthority: Keypair;

  seller: Keypair;
  buyer: Keypair;

  nft: Nft;

  constructor() {
    this.provider = anchor.AnchorProvider.env();
    anchor.setProvider(this.provider);
    this.metaplex = new Metaplex(this.provider.connection);
    this.payer = (this.provider.wallet as NodeWallet).payer;
    this.auctionHouseAuthority = new Keypair();
    this.seller = new Keypair();
    this.buyer = new Keypair();
  }

  async setup(): Promise<void> {
    await airdrop(this, [
      this.auctionHouseAuthority.publicKey,
      this.seller.publicKey,
      this.buyer.publicKey,
    ]);

    this.nft = (
      await this.metaplex
        .use(keypairIdentity(this.seller))
        .nfts()
        .create({
          uri: "https://arweave.net/123",
          name: "My NFT",
          sellerFeeBasisPoints: 100,
        })
        .run()
    ).nft;
  }
}