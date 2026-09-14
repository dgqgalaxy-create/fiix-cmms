import { useEffect, useRef, useState } from 'react';

const RECENT_KEY = 'fiix_chat_emoji_recent';
const RECENT_MAX = 32;

const readRecent = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((e): e is string => typeof e === 'string') : [];
  } catch {
    return [];
  }
};

const CATEGORIES: { id: string; icon: string; emojis: string }[] = [
  {
    id: 'caritas',
    icon: '😀',
    emojis:
      '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 💩 🤡 👹 👺 👻 👽 👾 🤖',
  },
  {
    id: 'gestos',
    icon: '👋',
    emojis:
      '👋 🤚 🖐 ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦵 🦶 👂 👃 🧠 👀 👅 👄',
  },
  {
    id: 'corazones',
    icon: '❤️',
    emojis:
      '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 💯 💢 💥 💫 💦 💨 💬 💭 💤',
  },
  {
    id: 'animales',
    icon: '🐶',
    emojis:
      '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐜 🐢 🐍 🦎 🐙 🦑 🦐 🦞 🦀 🐠 🐟 🐡 🐬 🐳 🐋 🦈 🐊 🐅 🐆 🦓 🦍 🦧 🐘 🦛 🦏 🐪 🐫 🦒 🦘 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🐩 🦮 🐈 🐓 🦃 🦚 🦜 🦢 🦩 🕊 🐇 🦝 🦨 🦡 🦦 🦥 🐁 🐀 🐿 🦔',
  },
  {
    id: 'comida',
    icon: '🍕',
    emojis:
      '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶 🌽 🥕 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🥙 🌮 🌯 🥗 🥘 🥫 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🦪 🍤 🍙 🍚 🍘 🍥 🥠 🥮 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🌰 🥜 🍯 🥛 🍼 ☕ 🍵 🧃 🥤 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🍾',
  },
  {
    id: 'actividades',
    icon: '⚽',
    emojis:
      '⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸ 🥌 🎿 ⛷ 🏂 🏋️ 🤼 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🤽 🚣 🧗 🚵 🚴 🏆 🥇 🥈 🥉 🏅 🎖 🏵 🎗 🎫 🎟 🎪 🤹 🎭 🩰 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🪕 🎸 🎻 🎲 ♟ 🎯 🎳 🎮 🎰 🧩',
  },
  {
    id: 'objetos',
    icon: '💡',
    emojis:
      '💡 🔦 🕯 🧯 🛢 💸 💵 💴 💶 💷 🪙 💰 💳 💎 ⚖️ 🧰 🔧 🔨 ⚒ 🛠 ⛏ 🔩 ⚙️ 🧱 ⛓ 🧲 🔫 💣 🧨 🪓 🔪 🗡 ⚔️ 🛡 🚬 ⚰️ 🪦 ⚱️ 🏺 🔮 📿 🧿 💈 ⚗️ 🔭 🔬 🩹 🩺 💊 💉 🧬 🦠 🧫 🧪 🌡 🧹 🧺 🧻 🚽 🚰 🚿 🛁 🛀 🧼 🪒 🧽 🧴 🛎 🔑 🗝 🚪 🪑 🛋 🛏 🛌 🧸 🖼 🛍 🛒 🎁 🎈 🎏 🎀 🪄 🪅 🎊 🎉 🎎 🏮 🎐 🧧 ✉️ 📩 📨 📧 💌 📥 📤 📦 🏷 📪 📫 📬 📭 📮 📯 📜 📃 📄 📑 🧾 📊 📈 📉 🗒 🗓 📆 📅 🗑 📇 🗃 🗳 🗄 📋 📁 📂 🗂 🗞 📰 📓 📔 📒 📕 📗 📘 📙 📚 📖 🔖 🧷 🔗 📎 🖇 📐 📏 🧮 📌 📍 ✂️ 🖊 🖋 ✒️ 🖌 🖍 📝 ✏️ 🔍 🔎 🔏 🔐 🔒 🔓',
  },
  {
    id: 'simbolos',
    icon: '✅',
    emojis:
      '✅ ❌ ❓ ❗ 💯 ⭐ 🌟 ⚡ 💥 ✨ 🎉 🎊 🎈 👑 🎯 🏁 🚩 🎌 🏴 ☮️ ✝️ ☪️ 🕉 ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🆔 ⚛️ 🉑 ☢️ ☣️ 📴 📳 🈶 🈚 🈸 🈺 🈷️ ✴️ 🆚 💮 🉐 ㊙️ ㊗️ 🈴 🈵 🈹 🈲 🅰️ 🅱️ 🆎 🆑 🅾️ 🆘 ⭕ 🛑 ⛔ 📛 🚫 ♨️ 🚷 🚯 🚳 🚱 🔞 📵 🚭 ❕ ❔ ‼️ ⁉️ 🔅 🔆 〽️ ⚠️ 🚸 🔱 ⚜️ 🔰 ♻️ 🈯 💹 ❇️ ✳️ ❎ 🌐 💠 Ⓜ️ 🌀 🏧 🚾 ♿ 🅿️ 🛗 🚹 🚺 🚼 🚻 🚮 🎦 📶 🔣 ℹ️ 🔤 🔡 🔠 🆖 🆗 🆙 🆒 🆕 🆓 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 🔢 #️⃣ *️⃣ ⏏️ ▶️ ⏸ ⏯ ⏹ ⏺ ⏭ ⏮ ⏩ ⏪ ⏫ ⏬ ◀️ 🔼 🔽 ➡️ ⬅️ ⬆️ ⬇️ ↗️ ↘️ ↙️ ↖️ ↕️ ↔️ ↪️ ↩️ ⤴️ ⤵️ 🔀 🔁 🔂 🔄 🔃 🎵 🎶 ➕ ➖ ➗ ✖️ 💲 💱 ™️ ©️ ®️ 〰️ ➰ ➿ 🔚 🔙 🔛 🔝 🔜 ✔️ ☑️ 🔘 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🔺 🔻 🔸 🔹 🔶 🔷 🔳 🔲 ▪️ ▫️ ◾ ◽ ◼️ ◻️ 🟥 🟧 🟨 🟩 🟦 🟪 ⬛ ⬜ 🟫 🔈 🔇 🔉 🔊 🔔 🔕 📣 📢 💭 🗯',
  },
];

const CATEGORY_EMOJIS = CATEGORIES.map((c) => ({ id: c.id, icon: c.icon, list: c.emojis.split(' ') }));

interface EmojiPickerProps {
  onPick: (emoji: string) => void;
  onClose: () => void;
}

/** Selector de emojis estilo WhatsApp: categorías + recientes (localStorage). */
export function EmojiPicker({ onPick, onClose }: EmojiPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [recent, setRecent] = useState<string[]>(readRecent);
  const [activeCat, setActiveCat] = useState<string>(() =>
    readRecent().length ? 'recientes' : 'caritas'
  );

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const pick = (emoji: string) => {
    setRecent((prev) => {
      const next = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, RECENT_MAX);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* almacenamiento no disponible */
      }
      return next;
    });
    onPick(emoji);
  };

  const activeList =
    activeCat === 'recientes'
      ? recent
      : CATEGORY_EMOJIS.find((c) => c.id === activeCat)?.list ?? [];

  const tabs = [
    ...(recent.length > 0 ? [{ id: 'recientes', icon: '🕐', title: 'Recientes' }] : []),
    ...CATEGORY_EMOJIS.map((c) => ({
      id: c.id,
      icon: c.icon,
      title: c.id.charAt(0).toUpperCase() + c.id.slice(1),
    })),
  ];

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Selector de emojis"
      className="absolute bottom-full right-0 z-40 mb-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex gap-0.5 overflow-x-auto border-b border-slate-100 p-1.5 dark:border-slate-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.title}
            onClick={() => setActiveCat(t.id)}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg transition-colors ${
              activeCat === t.id
                ? 'bg-emerald-100 dark:bg-emerald-950/60'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {t.icon}
          </button>
        ))}
      </div>
      <div className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto p-2">
        {activeList.map((emoji) => (
          <button
            key={emoji}
            type="button"
            title={emoji}
            onClick={() => pick(emoji)}
            className="rounded-lg p-1 text-xl leading-none transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
