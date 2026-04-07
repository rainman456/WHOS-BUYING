import type { Meta, StoryObj } from "@storybook/svelte";
import TradeTicker from "../components/TradeTicker.svelte";

const meta: Meta = {
  title:     "Components/TradeTicker",
  component: TradeTicker,
  tags:      ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** No trades yet — shows empty state */
export const Empty: Story = {};

/** Active feed — simulates live trade flow */
export const Active: Story = {
  parameters: {
    notes: "Scrolling trade feed with fade-in animation per row",
  },
};
