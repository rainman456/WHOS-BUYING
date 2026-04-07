import type { Meta, StoryObj } from "@storybook/svelte";
import PriceHeader from "../components/PriceHeader.svelte";

const meta: Meta = {
  title:     "Components/PriceHeader",
  component: PriceHeader,
  tags:      ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const PriceUp: Story = {
  parameters: { notes: "Green last price — upward movement" },
};

export const PriceDown: Story = {
  parameters: { notes: "Red last price — downward movement" },
};

export const NoData: Story = {
  parameters: { notes: "Dashes shown before first WebSocket message" },
};
