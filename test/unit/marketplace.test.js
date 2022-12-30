const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

let NftMarketplace, randomIpfsNft, deployer, marketplaceUser1, vrfCoordinatorV2Mock

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Staking Unit Tests", function () {
          beforeEach(async () => {
          })
          describe("Stake NFT", async () => {
              beforeEach(async () => {
                  await mintNft()
              })
              it("Stake", async () => {

              })
          })
      })