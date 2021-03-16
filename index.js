require('dotenv').config();

if (!process.env.SHIPPO_API_KEY || !process.env.CARRIER_ACCOUNT_ID || !process.env.FROM_ADDRESS_ID) {
  console.error('Please set the SHIPPO_API_KEY, CARRIER_ACCOUNT_ID, and FROM_ADDRESS_ID environment variables');
  process.exit(1);
}

const { DateTime } = require('luxon');
const chalk = require('chalk');
const shippo = require('shippo')(process.env.SHIPPO_API_KEY);
const fromAddressId = process.env.FROM_ADDRESS_ID;
const carrierAccountId = process.env.CARRIER_ACCOUNT_ID;

// Log data to the console for debugging.
const debug = (...data) => {
  data.forEach((data) => {
    if (typeof data === 'string') {
      console.log(chalk.green(data));
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  });
}

// Create a Shippo shipment and transaction.
const createTransaction = async (shipmentDate) => {
  const request = {
    shipment: {
        shipment_date: shipmentDate.toISO(),
        address_from: fromAddressId,
        address_to: {
            name: 'Billy Bob',
            'street1': '206 1ST ST',
            'street2': 'SUITE 202',
            city: 'Brooklyn',
            state: 'NY',
            country: 'US',
            zip: '11232',
            phone: '4151234567',
            email: 'mrhippo@goshippo.com',
        },
        parcels: [
            {
                weight: '1',
                length: '1',
                width: '2',
                height: '3',
                distance_unit: 'in',
                mass_unit: 'lb',
            }
        ]
    },
    carrier_account: carrierAccountId,
    servicelevel_token: 'dhl_ecommerce_parcel_plus_expedited',
    async: false,
  };

  debug('Creating transaction...', request);

  const response = await shippo.transaction.create(request);

  debug(response);

  return response;
};

// Create a Shippo manifest.
const createManifest = async (shipmentDate, transactionIds) => {
  const request = {
    address_from: fromAddressId,
    carrier_account: carrierAccountId,
    shipment_date: shipmentDate.toISO(),
    transactions: transactionIds,
    async: false,
  };

  debug('Creating manifest...', request);

  const response = await shippo.manifest.create(request);

  debug(response);

  return response;
};

const run = async () => {

  // Create two date times, 9 hours apart, for tomorrow. This ensures that they will be in the same timezone in UTC time
  // but different timezones in Pacific time. We have to use a date in the future because otherwise Shippo will silently
  // ignore the shipment date and use the current date & time.
  const dates = [
    DateTime.now().toUTC().plus({days: 1}).set({ hour: 2, minute: 0, second: 0, millisecond: 0}), // 2 AM UTC tomorrow
    DateTime.now().toUTC().plus({days: 1}).set({ hour: 11, minute: 0, second: 0, millisecond: 0}), // 11 AM UTC tomorrow
  ];

  debug(
    'Dates:',
    ...dates.map(
      (date) => `${date.toISO()} (${date.setZone('America/Los_Angeles').toISO()})`
    )
  );

  // Create a transaction for each date.
  const transactionIds = await Promise.all(dates.map(async (date) => {
    const transaction = await createTransaction(date);

    return transaction.object_id;
  }));

  // Now try to create a manifest for both transactions. We're using the date
  // of the first transaction, but either should work because they're both on
  // the same date in UTC time, but we get an error. You can also try
  // `dates[0].endOf('day')` to get something like `2021-03-17T23:59:59.999Z`.
  // That doesn't work either though.
  await createManifest(dates[0].endOf('day'), transactionIds);

  debug('Done!');
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });