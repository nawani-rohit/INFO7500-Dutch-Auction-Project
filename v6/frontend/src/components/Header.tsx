import { Flex, Heading } from '@chakra-ui/react';
import ConnectMetamask from './ConnectMetamask';

export default function Header() {
  return (
    <Flex
      direction="row"
      justifyContent="space-between"
      align="center"
      px={10}
      py={10}
    >
      <Heading as="h1">Basic Dutch Auction</Heading>
      <ConnectMetamask />
    </Flex>
  );
}
