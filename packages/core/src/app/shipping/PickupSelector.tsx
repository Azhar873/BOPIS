import React from 'react';

export interface PickupStore {
    id: number;
    name: string;
    readyTime?: string;
    instructions?: string;
}

export interface PickupSelectorProps {
    stores: PickupStore[];
    selectedId?: number;
    isLoading: boolean;
    errorMessage?: string;
    onSelect(id: number): void;
}

const PickupSelector: React.FC<PickupSelectorProps> = ({
    stores,
    selectedId,
    isLoading,
    errorMessage,
    onSelect,
}) => {
    if (isLoading) {
        return <p className="body-regular">Loading stores...</p>;
    }

    if (errorMessage) {
        return <p className="body-regular">{errorMessage}</p>;
    }

    if (!stores.length) {
        return <p className="body-regular">No pickup store available.</p>;
    }

    return (
        <div aria-label="Pickup store" className="form-body" role="radiogroup">
            {stores.map((store) => (
                <label
                    key={store.id}
                    style={{
                        display: 'block',
                        cursor: 'pointer',
                        padding: '12px',
                        marginBottom: '8px',
                        border: selectedId === store.id ? '2px solid #333' : '1px solid #ccc',
                    }}
                >
                    <input
                        checked={selectedId === store.id}
                        name="pickup-store"
                        onChange={() => onSelect(store.id)}
                        type="radio"
                        value={store.id}
                    />{' '}
                    <strong>{store.name}</strong>
                    {store.readyTime && <div>{store.readyTime}</div>}
                    {store.instructions && <small>{store.instructions}</small>}
                </label>
            ))}
        </div>
    );
};

export default PickupSelector;