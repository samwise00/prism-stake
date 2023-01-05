const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")
const { time } = require("@nomicfoundation/hardhat-network-helpers")

let NftMarketplace, randomIpfsNft, deployer, marketplaceUser1, vrfCoordinatorV2Mock

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Staking Unit Tests", function () {
          beforeEach(async () => {
              // get fixtures with deployer account for vrfCoordinatorV2Mock and ipfsNft
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              await deployments.fixture(["mocks", "prismstaking", "randomipfs", "prismerc20"])

              prismERC20 = await ethers.getContract("PrismERC20")
              randomIpfsNft = await ethers.getContract("IpfsNft")
              prismStaking = await ethers.getContract("PrismStaking")
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
          })
          describe("Stake NFT", async () => {
              beforeEach(async () => {
                  await mintNft()
              })
              it("Stake an NFT, event is emitted", async () => {
                  await randomIpfsNft.approve(prismStaking.address, "0")
                  await prismERC20.addController(prismStaking.address)

                  const stakeReponse = await prismStaking.stake(["0"])
                  const stakeReceipt = await stakeReponse.wait(1)

                  assert.equal(stakeReceipt.events[1].event, "NFTStaked")
              })
              it("Stake an NFT, user's balance updates and total staked increments", async () => {
                  await randomIpfsNft.approve(prismStaking.address, "0")
                  await prismERC20.addController(prismStaking.address)

                  const preStakeBalance = await prismStaking.balanceOf(deployer.address)
                  assert.equal(preStakeBalance, "0")

                  await prismStaking.stake(["0"])

                  const postStakeBalance = await prismStaking.balanceOf(deployer.address)
                  const postStakeTokensOfOwner = await prismStaking.tokensOfOwner(deployer.address)
                  const totalStaked = await prismStaking.getTotalStaked()
                  assert.equal(postStakeBalance, "1")
                  assert.equal(postStakeTokensOfOwner.toString(), ["0"])
                  assert.equal(totalStaked, "1")
              })
              it("NFT earns Prims tokens while staked", async () => {
                  await randomIpfsNft.approve(prismStaking.address, "0")
                  await prismERC20.addController(prismStaking.address)

                  await prismStaking.stake(["0"])
                  await time.increase(340000)

                  const tokensEarned = await prismStaking.earningInfo(deployer.address, ["0"])
                  assert.notEqual(tokensEarned[0], "0")
              })
          })
          describe("Unstake NFT", async () => {
              beforeEach(async () => {
                  await mintNft()
                  await randomIpfsNft.approve(prismStaking.address, "0")
                  await prismERC20.addController(prismStaking.address)

                  await prismStaking.stake(["0"])
              })
              it("Unstake an NFT, event is emitted", async () => {
                  const unstakeResponse = await prismStaking.unstake(["0"])
                  const unstakeReceipt = await unstakeResponse.wait(1)

                  assert.equal(unstakeReceipt.events[1].event, "NFTUnstaked")
                  assert.equal(unstakeReceipt.events[3].event, "Claimed")
              })
              it("Stake an NFT, user's balance updates", async () => {
                  const preUnstakeBalance = await prismStaking.balanceOf(deployer.address)
                  assert.equal(preUnstakeBalance.toString(), "1")

                  await prismStaking.unstake(["0"])

                  const postUnstakeBalance = await prismStaking.balanceOf(deployer.address)
                  assert.equal(postUnstakeBalance, "0")
              })
              it("Claiming does not unstake the NFT", async () => {
                  await time.increase(300000)
                  const tokensEarned = await prismStaking.earningInfo(deployer.address, ["0"])
                  assert.notEqual(tokensEarned[0], "0")

                  await prismStaking.claim(["0"])

                  const preUnstakeBalance = await prismStaking.balanceOf(deployer.address)
                  assert.equal(preUnstakeBalance.toString(), "1")
              })
          })

          describe("Claim Rewards", async () => {
              beforeEach(async () => {
                  await mintNft()
                  await randomIpfsNft.approve(prismStaking.address, "0")
                  await prismERC20.addController(prismStaking.address)

                  await mintNft()
                  await randomIpfsNft.approve(prismStaking.address, "1")
                  await prismStaking.stake(["0"])
                  await prismStaking.stake(["1"])
              })
              it("Claiming Prism rewards transfers $Prism to owner's wallet", async () => {
                  await time.increase(300000)
                  const rewardsDistributed = 0

                  await prismStaking.claim(["0"])
                  const balAfterFirstClaim = await prismERC20.balanceOf(deployer.address)

                  assert.equal(
                      balAfterFirstClaim.toString(),
                      rewardsDistributed + parseInt(balAfterFirstClaim.toString())
                  )

                  await prismStaking.claim(["1"])
                  const postUnstakeBalance = await prismStaking.balanceOf(deployer.address)
                  assert.equal(postUnstakeBalance.toString(), "2")
              })
          })
      })

const mintNft = async () => {
    const mintFee = await randomIpfsNft.getMintFee()
    const requestNftResponse = await randomIpfsNft.requestNft({
        value: mintFee,
    })
    const requestNftReceipt = await requestNftResponse.wait(1)
    await vrfCoordinatorV2Mock.fulfillRandomWords(
        requestNftReceipt.events[1].args.requestId,
        randomIpfsNft.address
    )
}
