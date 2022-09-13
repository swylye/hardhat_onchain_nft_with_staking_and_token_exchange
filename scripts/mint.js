const { network, ethers, getNamedAccounts, deployments } = require("hardhat")
const { networkConfig, developmentChains } = require("../helper-hardhat-config")

async function main() {
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    const nft = await ethers.getContract("SVGNFT", deployer)
    console.log("Initiating mint...")
    const transactionResponse = await nft.create({ value: networkConfig[chainId]['mintPrice'] })
    const transactionReceipt = await transactionResponse.wait(1)
    console.log("Minted!")
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.log(err)
        process.exit(1)
    })