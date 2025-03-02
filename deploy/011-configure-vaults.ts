import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { getContractAddressOrNullAddress } from "../helpers/deploymentConfig";

interface AdminAccounts {
  [key: string]: string;
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();

  const adminAccount: AdminAccounts = {
    sepolia: "0x94fa6078b6b8a26f0b6edffbe6501b22a10470fb", // SEPOLIA MULTISIG
    ethereum: "0x285960C5B22fD66A736C7136967A3eB15e93CC67", // ETHEREUM MULTISIG
    opbnbtestnet: "0xb15f6EfEbC276A3b9805df81b5FB3D50C2A62BDf", // OPBNBTESTNET MULTISIG
    opbnbmainnet: "0xC46796a21a3A9FAB6546aF3434F2eBfFd0604207", // OPBNBMAINNET MULTISIG
    bscmainnet: await getContractAddressOrNullAddress(deployments, "NormalTimelock"),
    bsctestnet: await getContractAddressOrNullAddress(deployments, "NormalTimelock"),
  };

  const accessControlManager = await ethers.getContract("AccessControlManager");

  const xvs = await ethers.getContract("XVS");
  const xvsVaultProxyDeployment = await ethers.getContract("XVSVaultProxy");
  const xvsStoreDeployment = await ethers.getContract("XVSStore");

  const xvsVaultProxy = await ethers.getContractAt("XVSVault", xvsVaultProxyDeployment.address);

  let txn = await xvsVaultProxy.setXvsStore(xvs.address, xvsStoreDeployment.address);
  await txn.wait();

  txn = await xvsVaultProxy.setAccessControl(accessControlManager.address);
  await txn.wait();

  if (!hre.network.live) {
    const tx = await accessControlManager.giveCallPermission(
      ethers.constants.AddressZero,
      "add(address,uint256,address,uint256,uint256)",
      deployer,
    );
    await tx.wait();

    // Add token pool to xvs vault
    const allocPoint = 100;
    const token = xvs.address;
    const rewardToken = xvs.address;
    const rewardPerBlock = "61805555555555555";
    const lockPeriod = 604800;

    await xvsVaultProxy.add(rewardToken, allocPoint, token, rewardPerBlock, lockPeriod);
  } else {
    const owner = adminAccount[hre.network.name];
    console.log("Please accept ownership of vault and store");
    txn = await xvsVaultProxyDeployment._setPendingAdmin(owner);
    await txn.wait();

    txn = await xvsStoreDeployment.setPendingAdmin(owner);
    await txn.wait();
  }
};

func.tags = ["xvs-vault"];
func.id = "xvs_vault_configuration"; // id required to prevent re-execution

export default func;
