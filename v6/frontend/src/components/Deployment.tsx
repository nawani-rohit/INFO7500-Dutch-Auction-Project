import {
  Button,
  Container,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  Input,
  InputGroup,
  InputRightAddon,
  Stack,
  Text,
  useToast
} from '@chakra-ui/react';
import { Web3Provider } from '@ethersproject/providers';
import { useWeb3React } from '@web3-react/core';
import { Contract, Signer, ethers } from 'ethers';
import { useEffect, useState } from 'react';

import BasicDutchAuctionArtifact from '../artifacts/contracts/BasicDutchAuction.sol/BasicDutchAuction.json';

export default function Deployment() {
  const [reservePrice, setReservePrice] = useState('');
  const [auctionDuration, setAuctionDuration] = useState('');
  const [decrementPerBlock, setDecrementPerBlock] = useState('');
  const [initialPrice, setInitialPrice] = useState('');
  const [deploying, setDeploying] = useState<boolean>(false);

  const toast = useToast();

  const { active, library } = useWeb3React<Web3Provider>();
  const [signer, setSigner] = useState<Signer>();
  const [basicDutchAuctionContract, setBasicDutchAuctionContract] =
    useState<Contract>();
  const [basicDutchAuctioContractAddr, setBasicDutchAuctionContractAddr] =
    useState<string>('');

  useEffect((): void => {
    if (!library) {
      setSigner(undefined);
      return;
    }

    setSigner(library.getSigner());
  }, [library]);

  useEffect((): void => {
    if (!basicDutchAuctionContract) {
      return;
    }

    async function getInitialPrice(): Promise<void> {
      const _initialPrice = await basicDutchAuctionContract?.initialPrice();

      if (_initialPrice.toString() !== initialPrice) {
        setInitialPrice(_initialPrice.toString());
      }
    }

    getInitialPrice();
  }, [basicDutchAuctionContract, initialPrice]);

  return (
    <Stack direction="column" spacing="6">
      <Heading as="h2">Deployment</Heading>
      <form onSubmit={handleDeploy}>
        <FormControl isRequired>
          <FormLabel>Reserve Price</FormLabel>
          <InputGroup>
            <Input
              variant="outline"
              bg="white"
              type="number"
              placeholder="10000"
              width="20rem"
              value={reservePrice}
              onChange={(event) => setReservePrice(event.target.value)}
            />
            <InputRightAddon bg="green.100" children="WEI" />
          </InputGroup>
          <FormHelperText>
            Lowest/Base price of the Auctioned item in wei
          </FormHelperText>
        </FormControl>
        <FormControl mt={6} isRequired>
          <FormLabel>Auction Duration</FormLabel>
          <InputGroup>
            <Input
              variant="outline"
              bg="white"
              type="number"
              placeholder="20"
              width="20rem"
              value={auctionDuration}
              onChange={(event) => setAuctionDuration(event.target.value)}
            />
            <InputRightAddon bg="green.100" children="BLOCKS" />
          </InputGroup>
          <FormHelperText>
            Number of blocks the auction remains open
          </FormHelperText>
        </FormControl>
        <FormControl mt={6} isRequired>
          <FormLabel>Decrement per block</FormLabel>
          <InputGroup>
            <Input
              variant="outline"
              bg="white"
              type="number"
              placeholder="500"
              width="20rem"
              value={decrementPerBlock}
              onChange={(event) => setDecrementPerBlock(event.target.value)}
            />
            <InputRightAddon bg="green.100" children="WEI" />
          </InputGroup>
          <FormHelperText>Decrement in offer price per block</FormHelperText>
        </FormControl>
        <Button
          variant="solid"
          mt={6}
          colorScheme="blue"
          type="submit"
          width="10rem"
          isDisabled={!active}
          isLoading={deploying}
        >
          Deploy
        </Button>
      </form>
      <Container maxW="40rem" bg="gray.200" p={6}>
        <Text fontWeight="bold">Contract Address:</Text>
        <Text>
          {basicDutchAuctioContractAddr?.length > 0
            ? basicDutchAuctioContractAddr
            : 'Contract not deployed'}
        </Text>
        <Text mt={6} fontWeight="bold">
          Initial Price:
        </Text>
        <Text>
          {initialPrice?.length > 0 ? initialPrice : 'Contract not deployed'}
        </Text>
      </Container>
    </Stack>
  );

  async function handleDeploy(event: any) {
    event.preventDefault();
    setDeploying(true);

    // only deploy the Greeter contract one time, when a signer is defined
    if (basicDutchAuctionContract || !signer) {
      setDeploying(false);
      return;
    }

    const BasicDutchAuctionContract = new ethers.ContractFactory(
      BasicDutchAuctionArtifact.abi,
      BasicDutchAuctionArtifact.bytecode,
      signer
    );

    try {
      const _basicDutchAuctionContract = await BasicDutchAuctionContract.deploy(
        reservePrice,
        auctionDuration,
        decrementPerBlock
      );
      await _basicDutchAuctionContract.deployed();
      const _initialPrice = await _basicDutchAuctionContract?.initialPrice();

      if (_initialPrice.toString() !== initialPrice) {
        setInitialPrice(_initialPrice.toString());
      }
      setBasicDutchAuctionContract(_basicDutchAuctionContract);
      setBasicDutchAuctionContractAddr(_basicDutchAuctionContract.address);
      toast({
        title: 'Success',
        description: `Basic Dutch Auction contract deployed to address ${_basicDutchAuctionContract.address}`,
        status: 'success',
        duration: 9000,
        isClosable: true
      });
    } catch (error: any) {
      console.log(error);
      toast({
        title: 'Error while deploying Basic Dutch Auction contract',
        description: error?.message?.substring(0, 120),
        status: 'error',
        duration: 9000,
        isClosable: true
      });
    } finally {
      setDeploying(false);
    }
  }
}
