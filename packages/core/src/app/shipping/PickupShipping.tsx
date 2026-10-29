import React, { useEffect, useState } from 'react';

import { TranslatedString } from '@bigcommerce/checkout/locale';
import { Button, ButtonVariant } from '@bigcommerce/checkout/ui';

import { useShipping } from './hooks/useShipping';
import PickupSelector, { type PickupStore } from './PickupSelector';

// TODO: apni store ke asli coordinates daalo
// Sirf fallback ke liye (jab customer location allow na kare)
const FALLBACK_CENTER = { latitude: 30.3753, longitude: 69.3451 };
const FALLBACK_RADIUS = { value: 1500, unit: 'KM' };
// Customer ki location mile to uske aas paas
const NEARBY_RADIUS = { value: 100, unit: 'KM' };

interface Coordinates {
    latitude: number;
    longitude: number;
}

const getCustomerLocation = (): Promise<Coordinates | undefined> =>
    new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(undefined);

            return;
        }

        navigator.geolocation.getCurrentPosition(
            ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
            () => resolve(undefined),
            { timeout: 5000 },
        );
    });

interface PickupMethodResponse {
    id: number;
    displayName?: string;
    collectionInstructions?: string;
    collectionTimeDescription?: string;
}

interface PickupOptionsResponse {
    results?: Array<{ pickupOptions?: Array<{ pickupMethod: PickupMethodResponse }> }>;
}

export interface PickupShippingProps {
    navigateNextStep(isBillingSameAsShipping: boolean): void;
    onUnhandledError(error: Error): void;
}

const PickupShipping: React.FC<PickupShippingProps> = ({ navigateNextStep, onUnhandledError }) => {
    const { cart, consignments, createConsignments, updateConsignment, isLoading } = useShipping();

    const [stores, setStores] = useState<PickupStore[]>([]);
    const [selectedId, setSelectedId] = useState<number | undefined>(
        consignments[0]?.selectedPickupOption?.pickupMethodId,
    );
    const [isLoadingStores, setIsLoadingStores] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>();

    useEffect(() => {
        let isActive = true;

        const fetchStores = async (
            coordinates: Coordinates,
            radius: { value: number; unit: string },
        ): Promise<PickupStore[]> => {
            const response = await fetch('/api/storefront/pickup-options', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    searchArea: { radius, coordinates },
                    items: cart.lineItems.physicalItems.map(({ variantId, quantity }) => ({
                        variantId,
                        quantity,
                    })),
                }),
            });

            if (!response.ok) {
                throw new Error(`Pickup options request failed (${response.status})`);
            }

            const data = (await response.json()) as PickupOptionsResponse;
            const byId = new Map<number, PickupStore>();

            (data.results || []).forEach((result) => {
                (result.pickupOptions || []).forEach(({ pickupMethod }) => {
                    byId.set(pickupMethod.id, {
                        id: pickupMethod.id,
                        name: pickupMethod.displayName || `Store ${pickupMethod.id}`,
                        readyTime: pickupMethod.collectionTimeDescription,
                        instructions: pickupMethod.collectionInstructions,
                    });
                });
            });

            return Array.from(byId.values());
        };

        const loadStores = async () => {
            try {
                const customer = await getCustomerLocation();
                let list = customer ? await fetchStores(customer, NEARBY_RADIUS) : [];

                // Location nahi mili ya paas mein koi store nahi: poore Pakistan mein dhoondo
                if (!list.length) {
                    console.log("fake data: no nearby stores found, fetching fallback");
                    list = await fetchStores(FALLBACK_CENTER, FALLBACK_RADIUS);
                }

                if (isActive) {
                    setStores(list);
                }
            } catch (error) {
                if (isActive) {
                    setErrorMessage('Unable to load pickup stores.');
                }
            } finally {
                if (isActive) {
                    setIsLoadingStores(false);
                }
            }
        };

        void loadStores();

        return () => {
            isActive = false;
        };
    }, []);

    const handleContinue = async () => {
        if (!selectedId) {
            return;
        }

        setIsSubmitting(true);

        try {
            const lineItems = cart.lineItems.physicalItems.map(({ id, quantity }) => ({
                itemId: id,
                quantity,
            }));
            const pickupOption = { pickupMethodId: selectedId };

            if (consignments.length > 0) {
                await updateConsignment({ id: consignments[0].id, lineItems, pickupOption });
            } else {
                await createConsignments([{ lineItems, pickupOption }]);
            }

            navigateNextStep(false);
        } catch (error) {
            if (error instanceof Error) {
                onUnhandledError(error);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <PickupSelector
                errorMessage={errorMessage}
                isLoading={isLoadingStores}
                onSelect={setSelectedId}
                selectedId={selectedId}
                stores={stores}
            />
            <div className="form-actions">
                <Button
                    className="body-bold"
                    disabled={!selectedId || isLoading || isSubmitting}
                    id="checkout-shipping-continue"
                    isLoading={isLoading || isSubmitting}
                    onClick={() => {
                        void handleContinue();
                    }}
                    type="button"
                    variant={ButtonVariant.Primary}
                >
                    <TranslatedString id="common.continue_action" />
                </Button>
            </div>
        </>
    );
};

export default PickupShipping;