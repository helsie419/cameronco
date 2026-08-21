# User Manual: Creating an Order

This guide explains how to create an order in the Cameron & Co CRM.

In the CRM, an order begins as a quote or claim. Once the customer or insurer approves the quote, it becomes a workshop job on the Job Board.

## Before You Start

You will need:

- The customer name and contact details
- The insurer name, if this is insurance work
- The claim number or internal reference
- Item details, including metal, stones, dimensions, and description
- Pricing or costing details for each item
- Any policy limits, excess, salvage, or settlement notes

## Step 1: Open Quotes & Jobs

1. From the top navigation, click **Quotes & Jobs**.
2. Click **New quote**.

This opens the quote entry screen.

## Step 2: Select or Create the Customer

1. In the **Customer** section, search for the customer by name, email, or phone.
2. If the customer appears, select the existing customer.
3. If the customer does not appear, enter the customer details:
   - First name
   - Last name
   - Email
   - Mobile
   - Address, suburb, state, and postcode
4. If creating a new customer, click **Continue with this customer**.

Important: Always search first to avoid duplicate customer records.

## Step 3: Enter Claim or Order Details

In the **Claim details** section, complete the relevant fields:

- **Insurer**: select the insurer, or leave as private/no insurer
- **Insurer contact**: choose a contact if applicable
- **Claim number**: enter the insurer claim number or order reference
- **Date received**: enter the date the work was received
- **Our reference**: enter Cameron & Co’s internal reference if used
- **Insurer reference**: enter a separate insurer reference if needed
- **Assessment type**: select the request type
- **Validation type**: select the validation type
- **Branch**: choose Melbourne or Sydney
- **Assessed by**: select the staff member responsible
- **Policy excess**: enter any policy excess
- **Settlement note**: add any special instruction, such as “Refer case manager”

The claim number and customer are required before the record can be saved.

## Step 4: Add Items

In the **Items on this claim** section:

1. Complete the first item card.
2. Select the item **Category** and **Item type**.
3. Add the description that should appear on the quote.
4. Enter specification details such as:
   - Metal type
   - Metal colour
   - Manufacture origin
   - Weight
   - Ring style, chain style, length, width, or finger size
   - Repair type
   - Internal comments
5. For watches, complete the watch details section.

To add more items, click **Add item**.

## Step 5: Add Stones

For each item, use the **Stones** table to enter:

- Stone type
- Shape
- Quantity
- Carat each
- Total carat
- Quality
- Certificate details
- Cost per carat
- Total stone cost

Only add stone rows that are relevant to the item.

## Step 6: Add Costing

Use the costing area on each item to calculate the item price.

Depending on the item, enter the relevant costing details:

- Metal or chain rate
- Weight in grams
- Setting tier and quantity
- Casting
- Labour hours
- Box and valuation
- Stone costs

The CRM calculates:

- Retail amount
- Insurance nett
- Liability

Check the totals before generating the quote.

## Step 7: Enter Settlement Details

In the **Settlement breakdown** section, enter:

- Postage, handling, and insurance
- Salvage or scrap allocation
- Overall unlisted policy limit, if applicable

The totals bar at the bottom shows:

- Number of items
- Total retail including GST
- Insurance nett
- Liability with limits applied

## Step 8: Save or Generate the Quote

At the bottom of the screen:

- Click **Save draft** if the order is not ready to quote.
- Click **Generate quote** when the quote is ready.

Generating a quote saves a quote version and snapshots the current rates and metal spot prices. If pricing changes later, the generated quote keeps the rates used at the time.

The claim moves to **Pending approval** — it cannot be emailed yet. On the **Quotes** pipeline, an admin picks themselves under **Approving as** and clicks **Approve** (use **PDF** first to check it). Only then does **Email quote** become available to send it to the customer.

## Step 9: Find the Quote Later

1. Go to **Quotes & Jobs**.
2. Use the search field to find the claim number, customer, or insurer.
3. Use the status filter if needed.
4. Click **Open** to return to the quote.

## Step 10: Approve the Quote

Before an order can become a workshop job, the quote must be approved.

Current note: the backend supports approved quotes and approved claims, but the current visible screens do not yet show a dedicated “Approve quote” button. Until that button is added, approval may need to be completed by an admin or through the existing backend process.

Once the claim status is **Approved**, it can be turned into a job.

## Step 11: Create the Workshop Job

1. Open **Job Board**.
2. Click **Create job from an approved claim**.
3. Find the approved claim in the list.
4. Click **Create job**.

The CRM creates a job and copies the claim/item information across. Staff do not need to re-type the order details.

## Step 12: Complete Job Details

On the Job Board:

1. Click the job card.
2. Set or update:
   - Stage
   - Owner
   - Start date
   - Due date
   - Items taken
3. Review the component lines.
4. Add supplier, stock number, invoice number, weight, rate, and actual cost as needed.
5. Click **Save changes**.

The job card will show the current margin based on quoted nett minus actual component costs.

## Order Stages

Workshop jobs move through these stages:

- Awaiting deposit
- CAD approval
- In production
- Quality check
- Ready for collection
- Completed
- Cancelled

Keep the stage up to date so the dashboard and job board reflect the current workload.

## Common Problems

### I cannot save the quote

Check that:

- A customer has been selected or created
- The claim number has been entered
- Address fields are complete if an address was started
- The database/API connection is working

### The approved claim does not appear on the Job Board

Check that:

- The claim has an approved quote
- The claim status is approved
- A job has not already been created for that claim

### The pricing looks wrong

Check:

- Item weight
- Metal or chain rate
- Setting quantity
- Labour hours
- Stone cost
- Policy limits
- Salvage allocation
- Current rate card values

## Good Practice

- Search for the customer before creating a new record.
- Use clear item descriptions because they appear on the quote.
- Save drafts while gathering missing information.
- Generate a new quote version when pricing changes.
- Keep job stages current.
- Record actual component costs as invoices arrive.
