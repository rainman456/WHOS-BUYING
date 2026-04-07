import type { Preview } from "@storybook/svelte";

const preview: Preview = {
  decorators: [
    (Story) => ({
      Component: Story,
      props: {},
    }),
  ],
  parameters: {
    backgrounds: {
      default: "dark",
      values: [{ name: "dark", value: "#0d1117" }],
    },
    layout: "fullscreen",
  },
};

export default preview;
