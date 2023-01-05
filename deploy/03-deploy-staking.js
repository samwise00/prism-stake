const { network, ethers } = require("hardhat")
const {
    developmentChains,
    networkConfig,
    VERIFICATION_BLOCK_CONFIRMATIONS,
} = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let BasicNftAddress, PrismERC20Address

    IpfsNft = await ethers.getContract("IpfsNft")
    PrismERC20 = await ethers.getContract("PrismERC20")

    IpfsNftAddress = IpfsNft.address
    PrismERC20Address = PrismERC20.address

    log("-----------------------------")

    const args = ["0x8d3c2BEF341C68445b3883d5D7e76f342E045287", PrismERC20Address]

    const prismstaking = await deploy("PrismStaking", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: VERIFICATION_BLOCK_CONFIRMATIONS || 1,
    })

    log("------------------")
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(prismstaking.address, args)
    }
}

module.exports.tags = ["all", "prismstaking", "main"]
