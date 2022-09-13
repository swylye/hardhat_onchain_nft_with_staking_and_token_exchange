const { ethers } = require("hardhat")

const networkConfig = {
    5: {
        name: "goerli",
        vrfCoordinatorAddress: "0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D",
        mintPrice: ethers.utils.parseEther("0.01"),
        subscriptionId: "488",
    },
    31337: {
        name: "hardhat",
        mintPrice: ethers.utils.parseEther("0.5"),
    }
}

const developmentChains = ["hardhat", "localhost"]

module.exports = {
    networkConfig,
    developmentChains,
}