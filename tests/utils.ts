import { Context } from "./ctx";
import {
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

export async function airdrop(
  ctx: Context,
  addresses: PublicKey[]
): Promise<void> {
  await ctx.provider.connection.confirmTransaction(
    await ctx.provider.connection.requestAirdrop(
      ctx.payer.publicKey,
      200_000_000 * (addresses.length + 1)
    )
  );

  const tx = new Transaction();

  for (let i = 0; i < addresses.length; i++) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: ctx.payer.publicKey,
        lamports: 200_000_000,
        toPubkey: addresses[i],
      })
    );
  }

  await sendAndConfirmTransaction(ctx.provider.connection, tx, [ctx.payer]);
}
