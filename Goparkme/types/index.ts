export interface ParkingSpot {
    id: number;
    location: string;
    coordinates: string;
    price: number; // For consistency, though may not be used directly
    hourly_rate: number;
    status: 'available' | 'occupied' | 'reserved';
    owner_username: string;
    description: string;
    contact: string;
    average_rating: string; // The API returns it as a string
    opening_hours: string;
    created_at: string;
  } 