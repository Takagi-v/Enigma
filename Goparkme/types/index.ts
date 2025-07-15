export interface ParkingSpot {
    id: number;
    owner_username: string;
    location: string;
    coordinates: string;
    price: number;
    hourly_rate: number;
    description: string;
    status: 'available' | 'occupied' | 'unavailable';
    average_rating: string; // The API returns it as a string
    opening_hours: string;
    created_at: string;
  } 