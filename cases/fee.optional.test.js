import StellarSDK from "stellar-sdk";

import { fetch } from "./util/fetchShim";
import getTomlFile from "./util/getTomlFile";
import getSep10Token from "./util/sep10";

const keyPair = StellarSDK.Keypair.random();
const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();

jest.setTimeout(30000);

describe("Fee", () => {
    let jwt;
    let toml;
    let depositAsset = {};

    beforeAll(async () => {
        try {
            toml = await getTomlFile(url);
        } catch (e) {
            throw "Invalid TOML formatting";
        }

        const response = await fetch(toml.TRANSFER_SERVER + "/info", {
            headers: {
                Origin: "https://www.website.com"
            }
        });

        const json = await response.json();

        const depositCurrencies = Object.keys(json.deposit);

        depositAsset.code = depositCurrencies.find(
            currency => json.deposit[currency]
        );
        depositAsset.minAmount = json.deposit[depositAsset.code].min_amount;
        
        jwt = await getSep10Token(url, keyPair);
    });

    it("has CORS on the fee endpoint", async () => {
        const response = await fetch(toml.TRANSFER_SERVER + "/fee", {
            headers: {
                Origin: "https://www.website.com"
            }
        });
        expect(response.headers.get("access-control-allow-origin")).toBe("*");
    });

    it('returns a proper error schema for a non-params fee request', async () => {
        const response = await fetch(
            toml.TRANSFER_SERVER + "/fee",
        );

        const json = await response.json();
        const errorSchema = {
            properties: {
                error: { type: "string" }
            }
        };

        expect(response.status).not.toEqual(200);
        expect(json).toMatchSchema(errorSchema);
    });

    it('returns a proper fee schema for deposit fee request', async () => {
        const paramString = `operation=deposit&asset_code=${depositAsset.code}&amount=${depositAsset.minAmount}`;
        const response = await fetch(
            toml.TRANSFER_SERVER + `/fee?${paramString}`, {
            headers: {
                Authorization: `Bearer ${jwt}`
            }
        });

        const json = await response.json();
        const feeSchema = {
            properties: {
                fee: { type: "number" }
            }
        };

        expect(response.status).toEqual(200);
        expect(json).toMatchSchema(feeSchema);
    });
});