local MarketplaceService = game:GetService("MarketplaceService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)

local Remotes = ReplicatedStorage.Remotes

local Shop = {}

-- Ownership is mirrored to a player attribute named after the pass key, e.g. "VIP".
function Shop.Has(player: Player, passKey: string): boolean
	return player:GetAttribute(passKey) == true
end

function Shop.Load(player: Player)
	for _, pass in Config.GamePasses do
		if pass.Id ~= 0 then
			local ok, owns = pcall(function()
				return MarketplaceService:UserOwnsGamePassAsync(player.UserId, pass.Id)
			end)
			player:SetAttribute(pass.Key, ok and owns == true)
		end
	end
end

function Shop.Init()
	MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, passId, purchased)
		if not purchased then
			return
		end
		for _, pass in Config.GamePasses do
			if pass.Id == passId then
				player:SetAttribute(pass.Key, true)
				Remotes.Notify:FireClient(player, "Спасибо за покупку: " .. pass.Display .. "!")
			end
		end
	end)
end

return Shop
