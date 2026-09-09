import { useRef } from "react";
import { Dialog } from "radix-ui";

export default function EntregasDrawer({ title, onClose, busy = false, children }) {
  const origin = useRef(document.activeElement);
  return <Dialog.Root open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="cl-drawer-backdrop ent-dialog-overlay" />
      <Dialog.Content className="cl-drawer ent-drawer ent-dialog-content" aria-describedby={undefined}
        onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}
        onInteractOutside={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => { event.preventDefault(); origin.current?.focus?.(); }}>
        <Dialog.Title className="sr-only">{title}</Dialog.Title>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
