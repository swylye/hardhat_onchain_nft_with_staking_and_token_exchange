const { network, ethers, getNamedAccounts } = require("hardhat")

async function main() {
    const { deployer } = await getNamedAccounts()
    const nft = await ethers.getContract("SVGNFT", deployer)
    console.log("Withdraw from contract...")
    const transactionResponse = await nft.withdrawFunds()
    const transactionReceipt = await transactionResponse.wait(1)
    console.log("Withdrawn!")
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.log(err)
        process.exit(1)
    })