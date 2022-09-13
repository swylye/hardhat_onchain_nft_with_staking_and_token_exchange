const { networkConfig, developmentChains } = require("../helper-hardhat-config")
const { getNamedAccounts, deployments, network, run, ethers } = require("hardhat")
const { verify } = require("../utils/verify")

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("10")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    let vrfCoordinatorAddress, subscriptionId, vrfCoordinatorV2Mock

    if (developmentChains.includes(network.name)) {
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorAddress = vrfCoordinatorV2Mock.address
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        subscriptionId = transactionReceipt.events[0].args.subId
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
    }
    else {
        vrfCoordinatorAddress = networkConfig[chainId]['vrfCoordinatorAddress']
        subscriptionId = networkConfig[chainId]['subscriptionId']
    }

    const MINT_PRICE = networkConfig[chainId]['mintPrice'] || ethers.utils.parseEther("0.01")
    const KEYHASH = networkConfig[chainId]['keyHash']
    const args = [subscriptionId, vrfCoordinatorAddress, MINT_PRICE]

    const nft = await deploy("SVGNFT", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    // const nft = await ethers.getContract("SVGNFT")

    if (chainId == 31337) {
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId.toNumber(), nft.address)
    }

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        await verify(nft.address, args)
    }
    log("========================================================================================================================================")
}

module.exports.tags = ["all", "nft"]