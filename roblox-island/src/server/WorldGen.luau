local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)

local WorldGen = {}

local island = Config.Island
local rng = Random.new()
local seed = rng:NextNumber(0, 10000)

local function heightAt(x: number, z: number): number
	local d = math.sqrt(x * x + z * z) / island.Radius
	local falloff = 1 - d * d
	local noise = math.noise(x / 90, z / 90, seed) * 0.7 + math.noise(x / 30, z / 30, seed + 17) * 0.3
	return falloff * island.MaxHeight + noise * 10 - 3
end

local function surfaceMaterial(h: number): Enum.Material
	if h < island.SeaLevel + 2.5 then
		return Enum.Material.Sand
	elseif h > island.MaxHeight * 0.85 then
		return Enum.Material.Rock
	end
	return Enum.Material.Grass
end

function WorldGen.Generate()
	local terrain = workspace.Terrain
	terrain:Clear()

	local extent = island.Radius * 1.4
	local cell = island.Cell
	local floor = island.SeaFloor
	local waterHeight = island.SeaLevel - floor
	local chunk = 256

	for x = -extent - chunk, extent + chunk, chunk do
		for z = -extent - chunk, extent + chunk, chunk do
			terrain:FillBlock(
				CFrame.new(x, floor + waterHeight / 2, z),
				Vector3.new(chunk, waterHeight, chunk),
				Enum.Material.Water
			)
		end
	end

	for x = -extent, extent, cell do
		for z = -extent, extent, cell do
			local h = heightAt(x, z)
			if h > floor + 2 then
				terrain:FillBlock(
					CFrame.new(x, (floor + h) / 2, z),
					Vector3.new(cell, h - floor, cell),
					Enum.Material.Ground
				)
				terrain:FillBlock(CFrame.new(x, h - 2, z), Vector3.new(cell, 4, cell), surfaceMaterial(h))
			end
		end
		task.wait()
	end
end

local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Include
rayParams.FilterDescendantsInstances = { workspace.Terrain }
rayParams.IgnoreWater = true

-- Returns a random point on dry land whose surface material is in `materials`.
function WorldGen.RandomSurface(materials: { Enum.Material }, attempts: number?): Vector3?
	for _ = 1, attempts or 30 do
		local angle = rng:NextNumber(0, math.pi * 2)
		local radius = math.sqrt(rng:NextNumber()) * island.Radius
		local origin = Vector3.new(math.cos(angle) * radius, 200, math.sin(angle) * radius)
		local hit = workspace:Raycast(origin, Vector3.new(0, -400, 0), rayParams)
		if hit and hit.Position.Y > island.SeaLevel + 0.5 and table.find(materials, hit.Material) then
			return hit.Position
		end
	end
	return nil
end

function WorldGen.GroundBelow(position: Vector3): Vector3?
	local hit = workspace:Raycast(position + Vector3.new(0, 20, 0), Vector3.new(0, -80, 0), rayParams)
	return hit and hit.Position
end

return WorldGen
