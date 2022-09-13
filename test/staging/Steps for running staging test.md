## Steps for running staging test
1. If you don't have an existing subscription ID on Goerli testnet, set it up [here](https://vrf.chain.link/goerli/new)
2. Once you have your subscription ID, edit the value into helper-hardhat-config.js file under the appropriate chainId
3. Deploy the contract onto Goerli testnet and take note of the deployed contract address
4. Add deployed contract address as consumer for the subscription ID
6. Make sure that the subscription is funded.
7. Proceed to run staging test
