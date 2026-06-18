# Payment Formulas

## Facility Score To Coefficients

For each sampled facility score W:

- W >= 90: Ec1 = 1, Ec2 = 1.
- 80 <= W < 90: Ec1 = [100 - (90 - W) * 0.5]%, Ec2 = 1.
- 70 <= W < 80: Ec1 = [95 - (80 - W) * 1]%, Ec2 = [100 - (80 - W) * 0.5]%. 
- 60 <= W < 70: Ec1 = [85 - (70 - W) * 1.5]%, Ec2 = [95 - (70 - W) * 1]%. 

Town-level Ec1/Ec2 are arithmetic averages of sampled facility coefficients. In this report family, chapter conclusions and payment tables normally use three-decimal rounded town coefficients.

## Availability Fee

Annual availability base Pk3 is usually in 万元/年.

Monthly availability base:

`Pk3_month_yuan = Pk3_wan_per_year * 10000 / 12`

Calculated monthly availability payment:

`availability_payment = Pk3_month_yuan * E1 * Ec2`

If construction-stage coefficient E1 is not finalized and the report temporarily sets E1=1, use E1=1 and note that later true-up may apply.

## O&M Fee

For first to seventh batches, sum the town's monthly O&M bases:

`om_base_month = batch1 + batch2 + ... + batch7`

Calculated monthly O&M payment:

`om_payment = om_base_month * Ec1`

When verifying original tables, use the rounded report coefficient, e.g. Ec1=0.996, if the table multiplies by that value.

## Eighth And Ninth Batch O&M

Use the report notes for operation-start timing:

- Eighth batch: first six months may use coefficient 1; from the seventh month to next assessment period use current assessment Ec1.
- Ninth batch: if operation is under six months, use coefficient 1 until the first applicable assessment cycle; later months may be temporarily not calculated or adjusted by the next assessment result.

Do not add eighth/ninth batch amounts to a town if the source table shows zero for that town.

## Deductions And Total

Availability deduction:

`availability_deduction = availability_base_month - availability_payment`

O&M deduction:

`om_deduction = om_base_month - om_payment`

Monthly total payable:

`monthly_total = availability_payment + om_payment + eighth_or_ninth_batch_payment_if_applicable`

Period total:

`period_total = monthly_total * number_of_months`

## Example: 赤溪镇

Scores: 98.9, 95.3, 86.8, 91.3, 98.9, 87.9, 97.8.

Facility Ec1 values: 1, 1, 0.984, 1, 1, 0.9895, 1.

Town Ec1 exact: 0.9962142857; report Ec1: 0.996. Ec2: 1.

Availability: 394.27万元/年 / 12 = 328558.33元/月.

First to seventh O&M base: 25506.33 + 8089.89 + 17004.22 + 10627.64 + 2125.53 + 19129.74 + 0 = 82483.35元/月.

O&M after assessment: 82483.35 * 0.996 = 82153.42元/月.

Monthly total: 328558.33 + 82153.42 = 410711.75元/月.

Monthly deduction: 82483.35 - 82153.42 = 329.93元/月.
