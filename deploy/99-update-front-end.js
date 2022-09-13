const { ether, network, ethers } = require("hardhat")
const fs = require("fs")

const FRONT_END_ADDRESSES_LOCATION = "../frontend_hardhat_onchain_svg_nft/constants/contractAddresses.json"
const FRONT_END_ABI_LOCATION = "../frontend_hardhat_onchain_svg_nft/constants/abi.json"

module.exports = async function () {
    if (process.env.UPDATE_FRONT_END) {
        console.log("Updating front end...")
        await updateContractAddresses()
        await updateAbi()
    }
}

async function updateAbi() {
    const nft = await ethers.getContract("SVGNFT")
    const staking = await ethers.getContract("SVGStaking")
    const exchange = await ethers.getContract("RewardTokenExchange")
    fs.writeFileSync(FRONT_END_ABI_LOCATION, nft.interface.format(ethers.utils.FormatTypes.json))
    fs.appendFileSync(FRONT_END_ABI_LOCATION, staking.interface.format(ethers.utils.FormatTypes.json))
    fs.appendFileSync(FRONT_END_ABI_LOCATION, exchange.interface.format(ethers.utils.FormatTypes.json))
}

async function updateContractAddresses() {
    const nft = await ethers.getContract("SVGNFT")
    const staking = await ethers.getContract("SVGStaking")
    const exchange = await ethers.getContract("RewardTokenExchange")
    const chainId = network.config.chainId.toString()
    const currentAddresses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESSES_LOCATION, "utf8"))
    if (chainId in currentAddresses) {
        if (!currentAddresses[chainId]["nft"].includes(nft.address)) {
            currentAddresses[chainId]["nft"].push(nft.address)
        }
    }
    else {
        currentAddresses[chainId]["nft"] = [nft.address]
    }

    if (chainId in currentAddresses) {
        if (!currentAddresses[chainId]["staking"].includes(staking.address)) {
            currentAddresses[chainId]["staking"].push(staking.address)
        }
    }
    else {
        currentAddresses[chainId]["staking"] = [staking.address]
    }

    if (chainId in currentAddresses) {
        if (!currentAddresses[chainId]["exchange"].includes(exchange.address)) {
            currentAddresses[chainId]["exchange"].push(exchange.address)
        }
    }
    else {
        currentAddresses[chainId]["exchange"] = [exchange.address]
    }

    fs.writeFileSync(FRONT_END_ADDRESSES_LOCATION, JSON.stringify(currentAddresses))
}

module.exports.tags = ['all', 'frontend']