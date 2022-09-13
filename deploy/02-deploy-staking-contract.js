const { networkConfig, developmentChains } = require("../helper-hardhat-config")
const { getNamedAccounts, deployments, network, run, ethers } = require("hardhat")
const { verify } = require("../utils/verify")


module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    const nft = await ethers.getContract("SVGNFT")
    const nftAddress = nft.address

    const args = [nftAddress]

    const staking = await deploy("SVGStaking", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    // const staking = await ethers.getContract("SVGStaking")


    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        await verify(staking.address, args)
    }
    log("========================================================================================================================================")
}

module.exports.tags = ["all", "staking"]