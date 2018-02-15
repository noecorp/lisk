/*
 * Copyright © 2018 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 */


/*
  DESCRIPTION: Rename rate column from mem_accounts table to rank.
               It also drops the default value and update the initial rank to null.

  PARAMETERS: None
*/

ALTER TABLE mem_accounts RENAME COLUMN rate TO "rank";
ALTER TABLE mem_accounts ALTER COLUMN rank DROP DEFAULT;
UPDATE mem_accounts SET rank = null;