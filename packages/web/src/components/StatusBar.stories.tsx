import type { Meta, StoryObj } from "@storybook/react";
import { createStore, Provider } from "jotai";
import type { ConnectionStatus } from "../state/jobsConnectionAtom";
import { jobsConnectionAtom } from "../state/jobsConnectionAtom";
import { StatusBar } from "./StatusBar";

const withStatus = (status: ConnectionStatus) => {
  const store = createStore();
  store.set(jobsConnectionAtom, status);
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  );
};

const meta: Meta<typeof StatusBar> = {
  title: "Components/StatusBar",
  component: StatusBar,
  parameters: { layout: "padded", backgrounds: { default: "dark" } },
};

export default meta;
type Story = StoryObj<typeof StatusBar>;

export const Connecting: Story = {
  decorators: [withStatus("connecting")],
};

export const Connected: Story = {
  decorators: [withStatus("connected")],
};

export const Unstable: Story = {
  decorators: [withStatus("unstable")],
};
