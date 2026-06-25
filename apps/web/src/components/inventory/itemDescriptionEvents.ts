const itemDescriptionOpenEvent = "nightclub:item-description-open";

export function announceItemDescriptionOpen(ownerId: string) {
  window.dispatchEvent(new CustomEvent<string>(itemDescriptionOpenEvent, { detail: ownerId }));
}

export function subscribeItemDescriptionOpen(ownerId: string, onOtherOpen: () => void) {
  function handleItemDescriptionOpen(event: Event) {
    if ((event as CustomEvent<string>).detail !== ownerId) {
      onOtherOpen();
    }
  }

  window.addEventListener(itemDescriptionOpenEvent, handleItemDescriptionOpen);
  return () => window.removeEventListener(itemDescriptionOpenEvent, handleItemDescriptionOpen);
}
