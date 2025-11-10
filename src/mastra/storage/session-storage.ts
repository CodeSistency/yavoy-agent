/**
 * Session Storage: Simple in-memory storage for trip state and preferences
 * 
 * This is a temporary solution for development. In production, this should be
 * replaced with proper database storage (e.g., using LibSQLStore directly
 * or a dedicated storage service).
 * 
 * For production, consider:
 * - Using Mastra's working memory with structured schemas
 * - Direct database access via LibSQLStore
 * - A dedicated storage service/API
 */

interface TripState {
  origin?: {
    name: string;
    coordinates: { lat: number; lng: number };
  };
  destination?: {
    name: string;
    coordinates: { lat: number; lng: number };
  };
  waypoints: Array<{
    name: string;
    coordinates: { lat: number; lng: number };
  }>;
  status: 'draft' | 'ready' | 'in_progress' | 'completed';
}

interface UserPreferences {
  avoidTolls: boolean;
  avoidHighways: boolean;
  preferredVehicleType: 'economy' | 'comfort' | 'premium';
}

interface SavedLocation {
  name: string;
  coordinates: { lat: number; lng: number };
  lastUsed?: string;
}

// In-memory storage (thread-scoped by threadId)
const tripStateStorage = new Map<string, TripState>();
const preferencesStorage = new Map<string, UserPreferences>();
const savedLocationsStorage = new Map<string, SavedLocation[]>();
const tripHistoryStorage = new Map<string, Array<{
  origin: string;
  destination: string;
  date: string;
  price: number;
}>>();

/**
 * Get or create a storage key for a thread/resource combination
 */
function getStorageKey(threadId?: string, resourceId?: string): string {
  return `${resourceId || 'default'}_${threadId || 'default'}`;
}

export const sessionStorage = {
  // Trip State
  getTripState(threadId?: string, resourceId?: string): TripState {
    const key = getStorageKey(threadId, resourceId);
    return tripStateStorage.get(key) || {
      origin: undefined,
      destination: undefined,
      waypoints: [],
      status: 'draft',
    };
  },

  setTripState(state: TripState, threadId?: string, resourceId?: string): void {
    const key = getStorageKey(threadId, resourceId);
    tripStateStorage.set(key, state);
  },

  // User Preferences
  getPreferences(threadId?: string, resourceId?: string): UserPreferences {
    const key = getStorageKey(threadId, resourceId);
    return preferencesStorage.get(key) || {
      avoidTolls: false,
      avoidHighways: false,
      preferredVehicleType: 'economy',
    };
  },

  setPreferences(prefs: UserPreferences, threadId?: string, resourceId?: string): void {
    const key = getStorageKey(threadId, resourceId);
    preferencesStorage.set(key, prefs);
  },

  // Saved Locations
  getSavedLocations(threadId?: string, resourceId?: string): SavedLocation[] {
    const key = getStorageKey(threadId, resourceId);
    return savedLocationsStorage.get(key) || [];
  },

  setSavedLocations(locations: SavedLocation[], threadId?: string, resourceId?: string): void {
    const key = getStorageKey(threadId, resourceId);
    savedLocationsStorage.set(key, locations);
  },

  // Trip History
  getTripHistory(threadId?: string, resourceId?: string): Array<{
    origin: string;
    destination: string;
    date: string;
    price: number;
  }> {
    const key = getStorageKey(threadId, resourceId);
    return tripHistoryStorage.get(key) || [];
  },

  addTripToHistory(
    trip: { origin: string; destination: string; date: string; price: number },
    threadId?: string,
    resourceId?: string
  ): void {
    const key = getStorageKey(threadId, resourceId);
    const history = tripHistoryStorage.get(key) || [];
    history.push(trip);
    tripHistoryStorage.set(key, history);
  },
};

