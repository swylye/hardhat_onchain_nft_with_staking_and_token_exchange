const { networkConfig, developmentChains } = require("../helper-hardhat-config")
const { getNamedAccounts, deployments, network, run, ethers } = require("hardhat")
const { verify } = require("../utils/verify")


module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    const staking = await ethers.getContract("SVGStaking")
    const stakingAddress = staking.address

    const args = [stakingAddress]

    const exchange = await deploy("RewardTokenExchange", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    // const exchange = await ethers.getContract("RewardTokenExchange")

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        await verify(exchange.address, args)
    }
    log("========================================================================================================================================")
}

module.exports.tags = ["all", "exchange"]