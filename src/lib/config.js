/* The numbers the whole app agrees on: where state is kept, how far ahead it
   looks, and what it will hand a host to schedule. */

export const STORE_KEY = "headsup:v1";

export const HORIZON_DAYS = 400;

export const APP_VERSION = "1.5.2";

/* How far ahead, and how many, the app hands to the host to schedule. Android's
   alarm scheduler and iOS both get unhappy past a few dozen pending
   notifications, and a reminder six weeks out will be republished long before
   it matters. */
export const SCHEDULE_DAYS = 30;

export const SCHEDULE_MAX = 60;
