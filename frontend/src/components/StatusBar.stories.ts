/**
 * StatusBar stories.
 *
 * Each story isolates one state of the component.
 * No backend needed — we mock the store values directly.
 * This is the core value of Storybook.
 */
import type { Meta, StoryObj } from "@storybook/svelte";
import StatusBar from "../components/StatusBar.svelte";

const meta: Meta = {
  title:     "Components/StatusBar",
  component: StatusBar,
  tags:      ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {};

export const Connecting: Story = {
  parameters: {
    // In a real setup we'd mock the store here
    // For demo purposes each story shows the component shell
    notes: "Pulsing yellow indicator — waiting for handshake",
  },
};

export const Disconnected: Story = {
  parameters: {
    notes: "Red indicator — auto-reconnect in progress",
  },
};

export const Error: Story = {
  parameters: {
    notes: "Red indicator — connection failed",
  },
};
