import React, { FormEvent, useEffect, useState } from 'react';
import {
  CookieDesign,
  MenuCategory,
  MenuItemVariant,
  PackagingOption,
  PreSaleEvent,
} from '@sugarsocietysc/shared';
import {
  createCookieDesign,
  createMenuCategory,
  createMenuVariant,
  listCookieDesigns,
  listEventPackaging,
  listMenuCategories,
  listMenuVariants,
  setEventPackaging,
  uploadMenuItemImage,
  updateCookieDesign,
  updateMenuCategory,
  updateMenuVariant,
} from '../api/catalog-admin-client';

interface MenuManagementProps {
  idToken: string | null;
  events: PreSaleEvent[];
  packaging: PackagingOption[];
  onChanged: () => Promise<void>;
}

function formText(form: FormData, name: string): string {
  return String(form.get(name) ?? '').trim();
}

function checked(form: FormData, name: string): boolean {
  return form.get(name) === 'on';
}

function toCents(value: string): number {
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0) throw new Error('Enter a valid price.');
  return Math.round(price * 100);
}

export default function MenuManagement({ idToken, events, packaging, onChanged }: MenuManagementProps) {
  const [eventId, setEventId] = useState('');
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [designs, setDesigns] = useState<CookieDesign[]>([]);
  const [variants, setVariants] = useState<MenuItemVariant[]>([]);
  const [assignedPackaging, setAssignedPackaging] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!eventId && events.length > 0) setEventId(events[0].id);
    if (eventId && !events.some((event) => event.id === eventId)) setEventId(events[0]?.id ?? '');
  }, [eventId, events]);

  async function reload() {
    if (!idToken || !eventId) return;
    const [nextCategories, nextDesigns, nextVariants, nextPackaging] = await Promise.all([
      listMenuCategories(idToken, eventId),
      listCookieDesigns(idToken, eventId),
      listMenuVariants(idToken, eventId),
      listEventPackaging(idToken, eventId),
    ]);
    setCategories(nextCategories);
    setDesigns(nextDesigns);
    setVariants(nextVariants);
    setAssignedPackaging(nextPackaging.map((option) => option.id));
  }

  useEffect(() => {
    setError(null);
    reload().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load event menu'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, idToken]);

  async function runAction(action: () => Promise<void>, success: string, form?: HTMLFormElement) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      if (form) form.reset();
      await reload();
      await onChanged();
      setNotice(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The change could not be saved');
    } finally {
      setSaving(false);
    }
  }

  function submit(
    event: FormEvent<HTMLFormElement>,
    action: (form: FormData) => Promise<void>,
    success: string,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    void runAction(() => action(new FormData(form)), success, form);
  }

  async function handleImageUpload(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file || !idToken) return;
    const form = input.form;
    setSaving(true);
    setError(null);
    try {
      const imageUrl = await uploadMenuItemImage(idToken, file);
      const imageUrlsField = form?.elements.namedItem('imageUrls');
      if (!(imageUrlsField instanceof HTMLTextAreaElement)) {
        throw new Error('Could not add the uploaded image to this menu item.');
      }
      imageUrlsField.value = [imageUrlsField.value.trim(), imageUrl].filter(Boolean).join('\n');
      input.value = '';
      setNotice('Image uploaded. Save the menu item to attach it to this event.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setSaving(false);
    }
  }

  const selectedEvent = events.find((event) => event.id === eventId);

  return (
    <section className="admin-menu-management">
      <h2>Event menu management</h2>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {notice && <p className="auth-message" role="status">{notice}</p>}
      <label>
        Pre-Sale event
        <select value={eventId} onChange={(event) => setEventId(event.target.value)} disabled={events.length === 0}>
          <option value="" disabled>Select an event</option>
          {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
        </select>
      </label>

      {selectedEvent && (
        <>
          <section>
            <h3>Categories</h3>
            <form className="admin-form" onSubmit={(event) => submit(event, async (form) => {
              if (!idToken) return;
              await createMenuCategory(idToken, {
                preSaleEventId: eventId,
                name: formText(form, 'name'),
                description: formText(form, 'description') || undefined,
                sortOrder: Number(formText(form, 'sortOrder') || 0),
                isActive: checked(form, 'isActive'),
              });
            }, 'Category created.')}>
              <input name="name" aria-label="Category name" placeholder="Category name" required />
              <input name="description" aria-label="Category description" placeholder="Description (optional)" />
              <input name="sortOrder" aria-label="Category sort order" type="number" min="0" defaultValue="0" />
              <label><input name="isActive" type="checkbox" defaultChecked /> Active</label>
              <button disabled={saving}>Create category</button>
            </form>
            <div className="admin-record-list">
              {categories.map((category) => (
                <details key={category.id}>
                  <summary>{category.name} · {category.isActive ? 'Active' : 'Inactive'}</summary>
                  <form className="admin-form" onSubmit={(event) => submit(event, async (form) => {
                    if (!idToken) return;
                    await updateMenuCategory(idToken, category.id, {
                      name: formText(form, 'name'),
                      description: formText(form, 'description') || undefined,
                      sortOrder: Number(formText(form, 'sortOrder') || 0),
                      isActive: checked(form, 'isActive'),
                    });
                  }, 'Category updated.')}>
                    <input name="name" aria-label="Category name" defaultValue={category.name} required />
                    <input name="description" aria-label="Category description" defaultValue={category.description ?? ''} />
                    <input name="sortOrder" aria-label="Category sort order" type="number" min="0" defaultValue={category.sortOrder} />
                    <label><input name="isActive" type="checkbox" defaultChecked={category.isActive} /> Active</label>
                    <button disabled={saving}>Save category</button>
                  </form>
                </details>
              ))}
            </div>
          </section>

          <section>
            <h3>Menu items</h3>
            <form className="admin-form" onSubmit={(event) => submit(event, async (form) => {
              if (!idToken) return;
              const maxQuantity = formText(form, 'maxQuantity');
              await createCookieDesign(idToken, {
                name: formText(form, 'name'),
                description: formText(form, 'description') || undefined,
                imageUrls: formText(form, 'imageUrls').split(/\r?\n|,/).map((url) => url.trim()).filter(Boolean),
                preSaleEventId: eventId,
                categoryId: formText(form, 'categoryId') || null,
                sortOrder: Number(formText(form, 'sortOrder') || 0),
                colors: formText(form, 'colors').split(',').map((color) => color.trim()).filter(Boolean),
                maxQuantity: maxQuantity ? Number(maxQuantity) : undefined,
                isActive: checked(form, 'isActive'),
              });
            }, 'Menu item created.')}>
              <input name="name" aria-label="Menu item name" placeholder="Item name" required />
              <select name="categoryId" aria-label="Menu category" defaultValue="">
                <option value="">Uncategorized</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <input name="description" aria-label="Item description" placeholder="Description" />
              <textarea name="imageUrls" aria-label="Item image URLs" placeholder="Image URLs (one per line)" />
              <label>
                Upload image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Upload a menu item image"
                  disabled={saving}
                  onChange={(event) => { void handleImageUpload(event.currentTarget); }}
                />
              </label>
              <input name="colors" aria-label="Item colors" placeholder="Colors, comma separated" />
              <input name="sortOrder" aria-label="Item sort order" type="number" min="0" defaultValue="0" />
              <input name="maxQuantity" aria-label="Maximum quantity in cookies" type="number" min="1" placeholder="Max cookies (optional)" />
              <label><input name="isActive" type="checkbox" defaultChecked /> Active</label>
              <button disabled={saving}>Create menu item</button>
            </form>
            <div className="admin-record-list">
              {designs.map((design) => (
                <details key={design.id}>
                  <summary>{design.name} · {design.isActive ? 'Active' : 'Inactive'}</summary>
                  <form className="admin-form" onSubmit={(event) => submit(event, async (form) => {
                    if (!idToken) return;
                    const maxQuantity = formText(form, 'maxQuantity');
                    await updateCookieDesign(idToken, design.id, {
                      name: formText(form, 'name'),
                      description: formText(form, 'description') || undefined,
                      imageUrls: formText(form, 'imageUrls').split(/\r?\n|,/).map((url) => url.trim()).filter(Boolean),
                      categoryId: formText(form, 'categoryId') || null,
                      sortOrder: Number(formText(form, 'sortOrder') || 0),
                      colors: formText(form, 'colors').split(',').map((color) => color.trim()).filter(Boolean),
                      maxQuantity: maxQuantity ? Number(maxQuantity) : undefined,
                      isActive: checked(form, 'isActive'),
                    });
                  }, 'Menu item updated.')}>
                    <input name="name" aria-label="Menu item name" defaultValue={design.name} required />
                    <select name="categoryId" aria-label="Menu category" defaultValue={design.categoryId ?? ''}>
                      <option value="">Uncategorized</option>
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                    <input name="description" aria-label="Item description" defaultValue={design.description ?? ''} />
                    <textarea name="imageUrls" aria-label="Item image URLs" defaultValue={design.imageUrls.join('\n')} />
                    <label>
                      Upload image
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        aria-label="Upload a menu item image"
                        disabled={saving}
                        onChange={(event) => { void handleImageUpload(event.currentTarget); }}
                      />
                    </label>
                    <input name="colors" aria-label="Item colors" defaultValue={design.colors.join(', ')} />
                    <input name="sortOrder" aria-label="Item sort order" type="number" min="0" defaultValue={design.sortOrder} />
                    <input name="maxQuantity" aria-label="Maximum quantity in cookies" type="number" min="1" defaultValue={design.maxQuantity ?? ''} />
                    <label><input name="isActive" type="checkbox" defaultChecked={design.isActive} /> Active</label>
                    <button disabled={saving}>Save item</button>
                  </form>
                  <h4>Pack variants</h4>
                  <form className="admin-form" onSubmit={(event) => submit(event, async (form) => {
                    if (!idToken) return;
                    await createMenuVariant(idToken, {
                      cookieDesignId: design.id,
                      label: formText(form, 'label') || undefined,
                      packSize: Number(formText(form, 'packSize')),
                      priceCents: toCents(formText(form, 'price')),
                      sortOrder: Number(formText(form, 'sortOrder') || 0),
                      isActive: checked(form, 'isActive'),
                    });
                  }, 'Pack variant created.')}>
                    <input name="label" aria-label="Pack label" placeholder="Label (optional)" />
                    <input name="packSize" aria-label="Cookies per pack" type="number" min="1" required placeholder="Pack size" />
                    <input name="price" aria-label="Pack price in dollars" type="number" min="0" step="0.01" required placeholder="Pack price ($)" />
                    <input name="sortOrder" aria-label="Variant sort order" type="number" min="0" defaultValue="0" />
                    <label><input name="isActive" type="checkbox" defaultChecked /> Active</label>
                    <button disabled={saving}>Add variant</button>
                  </form>
                  {variants.filter((variant) => variant.cookieDesignId === design.id).map((variant) => (
                    <form className="admin-form" key={variant.id} onSubmit={(event) => submit(event, async (form) => {
                      if (!idToken) return;
                      await updateMenuVariant(idToken, variant.id, {
                        label: formText(form, 'label') || undefined,
                        packSize: Number(formText(form, 'packSize')),
                        priceCents: toCents(formText(form, 'price')),
                        sortOrder: Number(formText(form, 'sortOrder') || 0),
                        isActive: checked(form, 'isActive'),
                      });
                    }, 'Pack variant updated.')}>
                      <input name="label" aria-label="Pack label" defaultValue={variant.label ?? ''} placeholder="Label" />
                      <input name="packSize" aria-label="Cookies per pack" type="number" min="1" defaultValue={variant.packSize} required />
                      <input name="price" aria-label="Pack price in dollars" type="number" min="0" step="0.01" defaultValue={(variant.priceCents / 100).toFixed(2)} required />
                      <input name="sortOrder" aria-label="Variant sort order" type="number" min="0" defaultValue={variant.sortOrder} />
                      <label><input name="isActive" type="checkbox" defaultChecked={variant.isActive} /> Active</label>
                      <button disabled={saving}>Save variant</button>
                    </form>
                  ))}
                </details>
              ))}
            </div>
          </section>

          <section>
            <h3>Packaging and add-ons</h3>
            <div className="admin-form">
              {packaging.map((option) => (
                <label key={option.id}>
                  <input
                    type="checkbox"
                    checked={assignedPackaging.includes(option.id)}
                    disabled={!option.isActive}
                    onChange={() => setAssignedPackaging((current) =>
                      current.includes(option.id)
                        ? current.filter((id) => id !== option.id)
                        : [...current, option.id],
                    )}
                  />
                  {option.name} · {(option.price / 100).toFixed(2)} · {option.type}
                </label>
              ))}
              <button
                type="button"
                disabled={saving}
                onClick={() => void runAction(async () => {
                  if (!idToken) return;
                  await setEventPackaging(idToken, eventId, assignedPackaging);
                }, 'Event packaging updated.')}
              >
                Save packaging assignment
              </button>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
