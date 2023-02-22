/* eslint-disable prefer-const */
import { BigDecimal, Address } from "@graphprotocol/graph-ts/index";
import { Pair, Token, Bundle } from "../generated/schema";
import { ZERO_BD, factoryContract, ADDRESS_ZERO, ONE_BD } from "./utils";
// TODO:
let WTLOS_ADDRESS = "0xfadbc0a9a30394055a90e9205dd470c6e794cd5a";
let USDT_WTLOS_PAIR = "0x3108a4ec070fc51f74ce00cda009578d594e35b8"; // created block 648115

export function getBnbPriceInUSD(): BigDecimal {
  // fetch eth prices for each stablecoin
  let usdtPair = Pair.load(USDT_WTLOS_PAIR); // usdt is token0

  if (usdtPair !== null) {
    return usdtPair.token0Price;
  } else {
    return ZERO_BD;
  }
}
// TODO:
// token where amounts should contribute to tracked volume and liquidity
// let WHITELIST: string[] = [
//   "0xfadbc0a9a30394055a90e9205dd470c6e794cd5a", // WTLOS
//   "0xc111c29a988ae0c0087d97b33c6e6766808a3bd3", // BUSD
//   "0x01445c31581c354b7338ac35693ab2001b50b9ae", // USDT
//   "0xe2c120f188ebd5389f71cf4d9c16d05b62a58993", // USDC
//   "0x85219708c49aa701871ad330a94ea0f41dff24ca", // WETH
//   // "0xcd7509b76281223f5b7d3ad5d47f8d7aa5c2b9bf", // USDV
//   // "0xe3f5a90f9cb311505cd691a46596599aa1a0ad7d", // DAI
//   // "0x639a647fbe20b6c8ac19e48e2de44ea792c62c5c", // WBTC
//   // "0xabf26902fd7b624e0db40d31171ea9dddf078351", // WAGYU
//   // "0x72eb7ca07399ec402c5b7aa6a65752b6a1dc0c27", // ASTRO
//   // "0x6292d721d00bddaf683e1e64e4fcc9588c95398d", // ADA
// ];

// tesnet
let WHITELIST: string[] = [
  "0xfadbc0a9a30394055a90e9205dd470c6e794cd5a", // WTLOS
  "0xd65e4e2a2ae7b773ac5e50dc84574f429169f832", // BUSD
  "0xb9746c6b50ad85833b062eb6b81245b9df0fd738", // USDT
  "0x104f1cd7caeda9a7aa5c0a416d14880aa0a8a7e3", // USDC
  "0xe94afce6d42f27aaca09af470181de1965aa719b", // WETH
];

// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_BNB = BigDecimal.fromString("10");

/**
 * Search through graph to find derived BNB per token.
 * @todo update to be derived BNB (add stablecoin estimates)
 **/
export function findBnbPerToken(token: Token): BigDecimal {
  if (token.id == WTLOS_ADDRESS) {
    return ONE_BD;
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < WHITELIST.length; ++i) {
    let pairAddress = factoryContract.getPair(Address.fromString(token.id), Address.fromString(WHITELIST[i]));
    if (pairAddress.toHex() != ADDRESS_ZERO) {
      let pair = Pair.load(pairAddress.toHex());
      if (pair.token0 == token.id && pair.reserveBNB.gt(MINIMUM_LIQUIDITY_THRESHOLD_BNB)) {
        let token1 = Token.load(pair.token1);
        return pair.token1Price.times(token1.derivedBNB as BigDecimal); // return token1 per our token * BNB per token 1
      }
      if (pair.token1 == token.id && pair.reserveBNB.gt(MINIMUM_LIQUIDITY_THRESHOLD_BNB)) {
        let token0 = Token.load(pair.token0);
        return pair.token0Price.times(token0.derivedBNB as BigDecimal); // return token0 per our token * BNB per token 0
      }
    }
  }
  return ZERO_BD; // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  bundle: Bundle,
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let price0 = token0.derivedBNB.times(bundle.bnbPrice);
  let price1 = token1.derivedBNB.times(bundle.bnbPrice);

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1)).div(BigDecimal.fromString("2"));
  }

  // take full value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0);
  }

  // take full value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1);
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  bundle: Bundle,
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let price0 = token0.derivedBNB.times(bundle.bnbPrice);
  let price1 = token1.derivedBNB.times(bundle.bnbPrice);

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1));
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).times(BigDecimal.fromString("2"));
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1).times(BigDecimal.fromString("2"));
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}
