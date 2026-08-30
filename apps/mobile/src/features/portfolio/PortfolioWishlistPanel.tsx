import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import type { PortfolioTask, PortfolioWishlist } from "@t3tools/contracts";
import { AppText as Text } from "../../components/AppText";

type Props = {
  readonly wishlists: ReadonlyArray<PortfolioWishlist>;
  readonly tasks: ReadonlyArray<PortfolioTask>;
  readonly isPending: boolean;
  readonly onCreate: (title: string, summary: string) => Promise<void>;
  readonly onPromote: (wishlist: PortfolioWishlist, task: PortfolioTask) => Promise<void>;
};

export function PortfolioWishlistPanel({
  wishlists,
  tasks,
  isPending,
  onCreate,
  onPromote,
}: Props) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit() {
    if (title.trim().length === 0 || summary.trim().length === 0 || saving) return;
    setSaving(true);
    try {
      await onCreate(title.trim(), summary.trim());
      setTitle("");
      setSummary("");
    } finally {
      setSaving(false);
    }
  }
  return (
    <View className="mt-6 gap-2">
      <Text className="px-2 text-sm font-t3-medium text-foreground-muted">Wishlist</Text>
      <View className="gap-3 rounded-[24px] bg-card p-5">
        <TextInput
          accessibilityLabel="Wishlist title"
          placeholder="Wishlist title"
          value={title}
          onChangeText={setTitle}
          className="rounded-[14px] border border-input-border bg-input px-4 py-3 text-base text-foreground"
        />
        <TextInput
          accessibilityLabel="Wishlist summary"
          placeholder="What should exist?"
          value={summary}
          onChangeText={setSummary}
          className="rounded-[14px] border border-input-border bg-input px-4 py-3 text-base text-foreground"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save wishlist item"
          disabled={title.trim().length === 0 || summary.trim().length === 0 || saving}
          onPress={() => void submit()}
          className="self-start rounded-[14px] bg-primary px-4 py-2.5 active:opacity-70 disabled:opacity-50"
        >
          <Text className="text-xs font-t3-bold uppercase text-primary-foreground">
            {saving ? "Saving..." : "Save wishlist"}
          </Text>
        </Pressable>
      </View>
      <View className="overflow-hidden rounded-[24px] bg-card">
        {wishlists.length > 0 ? (
          wishlists.map((wishlist) => (
            <View key={String(wishlist.wishlistId)} className="border-b border-border p-4">
              <Text className="text-base font-t3-medium text-foreground">{wishlist.title}</Text>
              <Text className="mt-1 text-sm text-foreground-muted">
                {wishlist.summary} - {wishlist.status}
              </Text>
              {wishlist.promotedTaskId === null && tasks.length > 0 ? (
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {tasks.map((task) => (
                    <Pressable
                      key={String(task.taskId)}
                      accessibilityRole="button"
                      accessibilityLabel={"Promote " + wishlist.title + " to " + task.title}
                      onPress={() => void onPromote(wishlist, task)}
                      className="rounded-[12px] border border-input-border bg-input px-3 py-2 active:opacity-70"
                    >
                      <Text className="text-xs text-foreground-muted">Promote to {task.title}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text className="mt-3 text-xs text-foreground-muted">
                  {wishlist.promotedTaskId === null
                    ? "Select an exact Task target to promote."
                    : "Already promoted"}
                </Text>
              )}
            </View>
          ))
        ) : (
          <Text className="p-5 text-sm text-foreground-muted">
            {isPending ? "Reading wishlist..." : "No wishlist items for the selected environment."}
          </Text>
        )}
      </View>
    </View>
  );
}
